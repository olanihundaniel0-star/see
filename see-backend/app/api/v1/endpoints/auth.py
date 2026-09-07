from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user_id


router = APIRouter()


@router.get("/me")
async def me(user_id: UUID = Depends(get_current_user_id)) -> dict[str, str]:
    return {"user_id": str(user_id)}
