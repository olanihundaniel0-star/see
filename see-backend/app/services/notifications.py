"""PostgreSQL is the schedule and delivery source of truth; Celery only wakes the dispatcher."""
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo
import hashlib
import logging
import httpx
from sqlalchemy import select, update, text, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import noload
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.notification import Notification, NotificationDelivery, NotificationPreference, PushDevice, SavedEvent
from app.models.reminder import Reminder
from app.models.job import JobApplication, JobStatus
from app.models.event import ScrapedEvent
from app.schemas.notification import Preferences

logger = logging.getLogger(__name__)
UTC = timezone.utc

def quiet_time(at, prefs):
    if prefs.quiet_start is None or prefs.quiet_start == prefs.quiet_end: return at
    local = at.astimezone(ZoneInfo(prefs.timezone))
    start, end = prefs.quiet_start, prefs.quiet_end
    inside = start <= local.hour < end if start < end else local.hour >= start or local.hour < end
    if not inside: return at
    next_day = start > end and local.hour >= start
    return (local.replace(hour=end,minute=0,second=0,microsecond=0) + timedelta(days=int(next_day))).astimezone(UTC)

async def preference(db,user_id):
    record = await db.get(NotificationPreference,user_id)
    return Preferences.model_validate(record) if record else Preferences()

async def put_notification(db,user_id,source,source_id,at,route,body,key):
    identity = hashlib.sha256(f'{user_id}:{key}'.encode()).hexdigest()
    statement = insert(Notification).values(id=uuid4(),user_id=user_id,dedupe_key=identity,source=source,source_id=source_id,
        send_at=at,status='pending',route=route,body=body)
    # Re-enable schedules that were cancelled by completion/disable toggles, but
    # never re-send alerts that already reached the delivery stage.
    await db.execute(statement.on_conflict_do_update(
        index_elements=['dedupe_key'],
        set_={'status':'pending','send_at':at,'route':route,'body':body},
        where=(Notification.status=='cancelled'),
    ))
    return identity

async def reconcile_user(db,user_id,now=None):
    now = now or datetime.now(UTC)
    # Serialize edits and scheduled reconciliation for this user.
    await db.execute(text('SELECT pg_advisory_xact_lock(hashtext(:key))'),{'key':str(user_id)})
    await db.flush()
    prefs = await preference(db,user_id)
    wanted=[]
    active_source_ids=[]
    async def add(source,source_id,due,route,label,overdue=False):
        if due is None: return
        active_source_ids.append(source_id)
        for offset in sorted(set([0] + ([-prefs.advance_minutes] if prefs.advance_minutes else []) + ([prefs.overdue_minutes] if overdue and prefs.overdue_minutes else []))):
            raw = due + timedelta(minutes=offset)
            at = quiet_time(raw,prefs)
            # Never flood a newly connected device with historical alerts.
            if at < now-timedelta(hours=1) or at > now+timedelta(days=32): continue
            body = ('An item is overdue. ' if offset>0 else '') + label
            key=f'{source}:{source_id}:{due.isoformat()}:{offset}:{at.isoformat()}'
            wanted.append(await put_notification(db,user_id,source,source_id,at,route,body,key))
    if prefs.enabled:
        if prefs.reminders:
            for r in (await db.execute(select(Reminder).where(Reminder.user_id==user_id,Reminder.is_completed.is_(False)))).scalars():
                await add('reminder',r.id,r.due_date,f'/reminders/{r.id}','Open SEE to review your reminder.',True)
        if prefs.jobs:
            jobs=(await db.execute(select(JobApplication).options(noload(JobApplication.checklists)).where(JobApplication.user_id==user_id,JobApplication.status.notin_([JobStatus.REJECTED,JobStatus.ARCHIVED])))).scalars()
            for j in jobs:
                for field in ['deadline','interview_at','assessment_at','follow_up_at']:
                    await add('job_'+field,j.id,getattr(j,field),f'/jobs/{j.id}','A career commitment is due. Open SEE for details.')
        if prefs.events:
            rows=(await db.execute(select(SavedEvent,ScrapedEvent).join(ScrapedEvent,SavedEvent.event_id==ScrapedEvent.id).where(SavedEvent.user_id==user_id))).all()
            for saved,event in rows:
                await add('event',saved.id,event.start_date,'/(tabs)/events','A saved event is starting soon.')
                await add('registration',saved.id,saved.registration_deadline,'/(tabs)/events','A saved event registration deadline is approaching.')
        local = now.astimezone(ZoneInfo(prefs.timezone))
        for day in range(2):
            at = local.replace(hour=prefs.agenda_hour,minute=0,second=0,microsecond=0)+timedelta(days=day)
            for source,enabled in [('daily',prefs.daily),('weekly',prefs.weekly and at.weekday()==0)]:
                if enabled and at.astimezone(UTC)>=now-timedelta(minutes=5):
                    send_at=quiet_time(at.astimezone(UTC),prefs)
                    horizon=send_at+timedelta(days=7 if source=='weekly' else 1)
                    reminders_count=await db.scalar(select(func.count()).select_from(Reminder).where(Reminder.user_id==user_id,Reminder.is_completed.is_(False),Reminder.due_date<=horizon))
                    jobs_count=await db.scalar(select(func.count()).select_from(JobApplication).where(JobApplication.user_id==user_id,JobApplication.status.notin_([JobStatus.REJECTED,JobStatus.ARCHIVED]),JobApplication.deadline<=horizon))
                    wanted.append(await put_notification(db,user_id,source,None,send_at,'/(tabs)',f'{reminders_count} reminders and {jobs_count} application deadlines in your {source} agenda, including overdue items.', f'{source}:{at.date()}:{send_at.isoformat()}'))
    invalid_snoozes=update(Notification).where(Notification.user_id==user_id,Notification.source=='snooze',Notification.source_id.is_not(None),Notification.status=='pending')
    if active_source_ids: invalid_snoozes=invalid_snoozes.where(Notification.source_id.notin_(active_source_ids))
    await db.execute(invalid_snoozes.values(status='cancelled'))
    managed=['reminder','job_deadline','job_interview_at','job_assessment_at','job_follow_up_at','event','registration','daily','weekly']
    stale=update(Notification).where(Notification.user_id==user_id,Notification.source.in_(managed),Notification.status=='pending')
    if wanted: stale=stale.where(Notification.dedupe_key.notin_(wanted))
    await db.execute(stale.values(status='cancelled'))
    if not prefs.enabled:
        await db.execute(update(Notification).where(Notification.user_id==user_id,Notification.status=='pending').values(status='cancelled'))

async def commit_with_notifications(db,user_id):
    await reconcile_user(db,user_id)
    await db.commit()

async def notify_job_status(db,user_id,job_id,status,message_key):
    prefs=await preference(db,user_id)
    if prefs.enabled and prefs.jobs:
        await put_notification(db,user_id,'job_status',job_id,quiet_time(datetime.now(UTC),prefs),f'/jobs/{job_id}',
            'A verified career update is available in SEE.',f'status:{message_key}:{job_id}:{status}')

async def dispatch_notifications():
    now=datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        # One dispatcher per database. The lease is short: sends happen outside this transaction.
        locked=await db.scalar(text('SELECT pg_try_advisory_xact_lock(593331)'))
        if not locked: return {'claimed':0,'busy':True}
        users=(await db.execute(select(PushDevice.user_id).where(PushDevice.active.is_(True),PushDevice.last_seen_at>now-timedelta(days=30)).distinct())).scalars().all()
        for user_id in users: await reconcile_user(db,user_id,now)
        # An interrupted/ambiguous send is not retried automatically: Expo has no idempotency key.
        await db.execute(update(NotificationDelivery).where(NotificationDelivery.status=='sending',NotificationDelivery.updated_at<now-timedelta(minutes=5)).values(status='unknown',error='Interrupted send; outcome unknown'))
        # Local notifications are delivered by the OS; retire their delivery rows and
        # pending records once the scheduled time has passed.
        await db.execute(update(NotificationDelivery).where(NotificationDelivery.status=='local',NotificationDelivery.next_attempt_at<now-timedelta(minutes=5)).values(status='delivered',updated_at=now))
        due=(await db.execute(select(Notification,PushDevice).join(PushDevice,PushDevice.user_id==Notification.user_id).where(
            Notification.status=='pending',Notification.send_at<=now,Notification.send_at>now-timedelta(hours=1),PushDevice.active.is_(True),PushDevice.last_seen_at>now-timedelta(days=30)))).all()
        for n,d in due:
            await db.execute(insert(NotificationDelivery).values(id=uuid4(),notification_id=n.id,device_id=d.id,status='pending',attempts=0,next_attempt_at=now,updated_at=now)
                .on_conflict_do_nothing(index_elements=['notification_id','device_id']))
        rows=(await db.execute(select(NotificationDelivery,Notification,PushDevice).join(Notification,Notification.id==NotificationDelivery.notification_id).join(PushDevice,PushDevice.id==NotificationDelivery.device_id).where(
            NotificationDelivery.status=='pending',NotificationDelivery.next_attempt_at<=now,NotificationDelivery.attempts<5,
            Notification.status=='pending',Notification.send_at<=now,PushDevice.active.is_(True),PushDevice.user_id==Notification.user_id)
            .order_by(Notification.send_at).limit(100).with_for_update(of=NotificationDelivery,skip_locked=True))).all()
        batch=[]
        for delivery,n,device in rows:
            prefs=await preference(db,n.user_id)
            if not prefs.enabled:
                delivery.status='cancelled';continue
            shifted=quiet_time(now,prefs)
            if shifted>now:
                delivery.next_attempt_at=shifted;continue
            delivery.status='sending';delivery.attempts+=1;delivery.updated_at=now
            batch.append((delivery.id,device.id,{'to':device.token,'title':'SEE','body':n.body,'sound':'default','channelId':'commitments',
                'categoryId':'commitment','data':{'notification_id':str(n.id),'user_id':str(n.user_id),'route':n.route},'ttl':3600}))
        # Records with no deliverable device must not remain in the upcoming
        # list forever. Never expire a notification that still has a delivery
        # waiting for a retry or quiet-hour shift.
        pending_deliveries=select(NotificationDelivery.notification_id).where(
            NotificationDelivery.status.in_(['pending','sending']))
        await db.execute(update(Notification).where(
            Notification.status=='pending',
            Notification.send_at<now-timedelta(minutes=5),
            Notification.id.notin_(pending_deliveries)).values(status='expired'))
        await db.commit()
    if batch:
        headers={'Authorization':f'Bearer {settings.EXPO_ACCESS_TOKEN.get_secret_value()}'} if settings.EXPO_ACCESS_TOKEN else {}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response=await client.post('https://exp.host/--/api/v2/push/send',json=[b[2] for b in batch],headers=headers)
            if response.status_code==429:
                results=[{'status':'retry','details':{'error':'RateLimited'}}]*len(batch)
            else:
                response.raise_for_status()
                results=response.json().get('data',[])
                if not isinstance(results,list) or len(results)!=len(batch): raise ValueError('Invalid Expo ticket response')
        except Exception:
            logger.exception('Push send outcome unknown; not retrying to prevent duplicates')
            results=[{'status':'unknown'}]*len(batch)
        async with AsyncSessionLocal() as db:
            notification_ids=set()
            for (delivery_id,device_id,_),result in zip(batch,results):
                delivery=await db.get(NotificationDelivery,delivery_id)
                error=result.get('details',{}).get('error')
                retryable=result.get('status')=='retry' or error=='MessageRateExceeded'
                if result.get('status')=='ok': delivery.status='accepted'
                elif retryable: delivery.status='failed' if delivery.attempts>=5 else 'pending'
                elif result.get('status')=='unknown': delivery.status='unknown'
                else: delivery.status='failed'
                delivery.receipt_id=result.get('id');delivery.error=error;delivery.updated_at=now
                delivery.next_attempt_at=now+timedelta(seconds=min(3600,60*2**delivery.attempts))
                notification_ids.add(delivery.notification_id)
                if error=='DeviceNotRegistered':
                    await db.execute(update(PushDevice).where(PushDevice.id==device_id).values(active=False))
                    await db.execute(update(NotificationDelivery).where(
                        NotificationDelivery.device_id==device_id,
                        NotificationDelivery.status.in_(['pending','sending'])).values(
                        status='failed',error='DeviceNotRegistered',updated_at=now))
            # A notification can fan out to several devices and the pending batch
            # is capped. Mark it sent only when no device delivery still needs a
            # send; otherwise the next dispatch pass could never pick it up.
            if notification_ids:
                blocking=select(NotificationDelivery.notification_id).where(
                    NotificationDelivery.notification_id.in_(notification_ids),
                    NotificationDelivery.status.in_(['pending','sending']))
                await db.execute(update(Notification).where(
                    Notification.id.in_(notification_ids),
                    Notification.status=='pending',
                    Notification.id.notin_(blocking)).values(status='sent'))
            await db.commit()
    await check_receipts()
    return {'claimed':len(batch)}

async def check_receipts():
    now=datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        deliveries=(await db.execute(select(NotificationDelivery).where(NotificationDelivery.status=='accepted',NotificationDelivery.updated_at<now-timedelta(minutes=15)).limit(100))).scalars().all()
        ids=[d.receipt_id for d in deliveries if d.receipt_id]
    if not ids:return
    headers={'Authorization':f'Bearer {settings.EXPO_ACCESS_TOKEN.get_secret_value()}'} if settings.EXPO_ACCESS_TOKEN else {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response=await client.post('https://exp.host/--/api/v2/push/getReceipts',json={'ids':ids},headers=headers)
            response.raise_for_status();receipts=response.json().get('data',{})
    except (httpx.HTTPError,ValueError):
        logger.warning('Push receipt check failed; will retry');return
    async with AsyncSessionLocal() as db:
        for old in deliveries:
            receipt=receipts.get(old.receipt_id)
            if not receipt:continue
            d=await db.get(NotificationDelivery,old.id)
            d.status='delivered' if receipt.get('status')=='ok' else 'failed'
            d.error=receipt.get('details',{}).get('error')
            if d.error=='DeviceNotRegistered':
                await db.execute(update(PushDevice).where(PushDevice.id==d.device_id).values(active=False))
                await db.execute(update(NotificationDelivery).where(
                    NotificationDelivery.device_id==d.device_id,
                    NotificationDelivery.status.in_(['pending','sending'])).values(
                    status='failed',error='DeviceNotRegistered',updated_at=now))
        await db.commit()
