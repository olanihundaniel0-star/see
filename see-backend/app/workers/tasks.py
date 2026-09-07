from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.extract_email")
def extract_email(payload: dict) -> dict:
    return {"queued": True, "payload": payload}
