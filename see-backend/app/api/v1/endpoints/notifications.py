from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.notification import Notification, NotificationDelivery, NotificationPreference, PushDevice, SavedEvent
from app.models.event import ScrapedEvent
from app.schemas.notification import Preferences, DeviceRegistration, SaveEvent, LocalClaim, Snooze
from app.services.notifications import preference, reconcile_user, put_notification, quiet_time

router=APIRouter()

@router.get('/preferences',response_model=Preferences)
async def get_preferences(user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    return await preference(db,user_id)

@router.put('/preferences',response_model=Preferences)
async def set_preferences(payload:Preferences,user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    await db.execute(insert(NotificationPreference).values(user_id=user_id,**payload.model_dump()).on_conflict_do_update(index_elements=['user_id'],set_=payload.model_dump()))
    await reconcile_user(db,user_id)
    await db.commit()
    return payload

@router.post('/devices')
async def register_device(payload:DeviceRegistration,user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    now=datetime.now(timezone.utc)
    owner=await db.scalar(select(PushDevice.id).where(PushDevice.token==payload.token, PushDevice.user_id!=user_id))
    if owner is not None:
        # The token moved to a new account. Its old queued pushes must never be
        # delivered with the previous owner's route/body.
        await db.execute(update(NotificationDelivery).where(
            NotificationDelivery.device_id==owner,
            NotificationDelivery.status.in_(['pending','sending'])).values(
            status='failed',error='Token reassigned',updated_at=now))
    # Create preferences with the device's IANA zone when the account has no
    # explicit settings yet. Existing user choices are never overwritten here.
    await db.execute(insert(NotificationPreference).values(user_id=user_id,timezone=payload.timezone).on_conflict_do_nothing(index_elements=['user_id']))
    device_id=await db.scalar(insert(PushDevice).values(id=uuid4(),user_id=user_id,token=payload.token,active=True,last_seen_at=now)
        .on_conflict_do_update(index_elements=['token'],set_={'user_id':user_id,'active':True,'last_seen_at':now}).returning(PushDevice.id))
    await reconcile_user(db,user_id)
    await db.commit()
    return {'id':str(device_id)}

@router.delete('/devices/{device_id}',status_code=204)
async def revoke_device(device_id:UUID,user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    owns=await db.scalar(select(PushDevice.id).where(PushDevice.id==device_id,PushDevice.user_id==user_id))
    if owns is not None:
        await db.execute(update(PushDevice).where(PushDevice.id==device_id).values(active=False))
        await db.execute(update(NotificationDelivery).where(
            NotificationDelivery.device_id==device_id,
            NotificationDelivery.status.in_(['pending','sending'])).values(
            status='failed',error='Device revoked',updated_at=datetime.now(timezone.utc)))
    await db.commit()

@router.get('')
async def list_notifications(user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    now=datetime.now(timezone.utc)
    locally_scheduled=select(NotificationDelivery.notification_id).where(NotificationDelivery.status=='local',NotificationDelivery.next_attempt_at>now)
    rows=(await db.execute(select(Notification).where(
        Notification.user_id==user_id,
        Notification.send_at>now-timedelta(minutes=5),
        or_(Notification.status=='pending',Notification.id.in_(locally_scheduled)),
    ).order_by(Notification.send_at.asc()).limit(100))).scalars()
    return [{'id':str(n.id),'send_at':n.send_at,'route':n.route,'body':n.body,'source':n.source} for n in rows]

@router.post('/{notification_id}/snooze')
async def snooze(notification_id:UUID,payload:Snooze,user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    # Locally claimed alerts can coexist with a push sent to another device;
    # allow snoozing either pending or recently dispatched notifications.
    n=await db.scalar(select(Notification).where(Notification.id==notification_id,Notification.user_id==user_id,
        Notification.status.in_(['pending','sent']),Notification.send_at>datetime.now(timezone.utc)-timedelta(hours=1)))
    if n is None:raise HTTPException(404,'Notification not found')
    prefs=await preference(db,user_id)
    if not prefs.enabled:raise HTTPException(409,'Notifications disabled')
    at=quiet_time(datetime.now(timezone.utc)+timedelta(minutes=payload.minutes),prefs)
    # Repeated taps within a minute create one snooze.
    key=await put_notification(db,user_id,'snooze',n.source_id,at,n.route,n.body,f'snooze:{n.id}:{at.replace(second=0,microsecond=0).isoformat()}')
    saved=await db.scalar(select(Notification).where(Notification.dedupe_key==key))
    await db.commit()
    return {'id':str(saved.id),'send_at':saved.send_at,'route':saved.route,'body':saved.body}

@router.post('/{notification_id}/local')
async def claim_local(notification_id:UUID,payload:LocalClaim,user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    now=datetime.now(timezone.utc)
    n=await db.scalar(select(Notification).where(Notification.id==notification_id,Notification.user_id==user_id,Notification.status=='pending',Notification.send_at>now+timedelta(seconds=60)).with_for_update())
    device=await db.scalar(select(PushDevice).where(PushDevice.id==payload.device_id,PushDevice.user_id==user_id,PushDevice.active.is_(True)))
    if n is None or device is None:raise HTTPException(409,'Local scheduling is no longer available')
    result=await db.execute(insert(NotificationDelivery).values(id=uuid4(),notification_id=n.id,device_id=device.id,status='local',attempts=0,next_attempt_at=n.send_at,updated_at=now)
        .on_conflict_do_nothing(index_elements=['notification_id','device_id']).returning(NotificationDelivery.id))
    if result.scalar_one_or_none() is None:
        existing=await db.scalar(select(NotificationDelivery).where(NotificationDelivery.notification_id==n.id,NotificationDelivery.device_id==device.id,NotificationDelivery.status=='local'))
        if existing is None:raise HTTPException(409,'Notification already assigned')
    await db.commit()
    return {'scheduled':True}

@router.get('/saved-events')
async def saved_events(user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    rows=(await db.execute(select(SavedEvent).where(SavedEvent.user_id==user_id))).scalars()
    return [{'event_id':str(r.event_id),'registration_deadline':r.registration_deadline} for r in rows]

@router.put('/saved-events/{event_id}')
async def save_event(event_id:UUID,payload:SaveEvent,user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    if await db.get(ScrapedEvent,event_id) is None:raise HTTPException(404,'Event not found')
    await db.execute(insert(SavedEvent).values(id=uuid4(),user_id=user_id,event_id=event_id,registration_deadline=payload.registration_deadline).on_conflict_do_update(index_elements=['user_id','event_id'],set_={'registration_deadline':payload.registration_deadline}))
    await reconcile_user(db,user_id);await db.commit()
    return {'saved':True}

@router.delete('/saved-events/{event_id}',status_code=204)
async def unsave_event(event_id:UUID,user_id:UUID=Depends(get_current_user_id),db:AsyncSession=Depends(get_db)):
    from sqlalchemy import delete
    await db.execute(delete(SavedEvent).where(SavedEvent.user_id==user_id,SavedEvent.event_id==event_id))
    await reconcile_user(db,user_id);await db.commit()
