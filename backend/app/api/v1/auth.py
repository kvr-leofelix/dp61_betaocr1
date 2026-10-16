from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.models.entities import User, SchoolMembership, AuditEvent, utc_now
from backend.app.schemas.auth import LoginRequest, TokenResponse, UserOut, SwitchSchoolRequest
from backend.app.api.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == req.email.lower()))
    user = result.scalars().first()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    access_token = create_access_token(subject=user.id, school_id=user.school_id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id)

    # Log audit event
    audit = AuditEvent(
        timestamp=utc_now().strftime("%Y-%m-%d %H:%M"),
        user_id=user.id,
        user_name=user.name,
        action="User Login",
        details=f"Successful authentication for persona: {user.role} ({user.email})",
        category="user"
    )
    db.add(audit)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.get("/memberships")
async def get_my_memberships(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SchoolMembership).filter(SchoolMembership.user_id == current_user.id))
    memberships = result.scalars().all()
    return [{"id": m.id, "school_id": m.school_id, "role": m.role} for m in memberships]


@router.post("/switch-school", response_model=TokenResponse)
async def switch_school(req: SwitchSchoolRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        result = await db.execute(
            select(SchoolMembership).filter(
                SchoolMembership.user_id == current_user.id,
                SchoolMembership.school_id == req.school_id,
                SchoolMembership.is_active == True
            )
        )
        if not result.scalars().first() and current_user.school_id != req.school_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized school switch.")

    current_user.school_id = req.school_id
    await db.commit()
    await db.refresh(current_user)

    access_token = create_access_token(subject=current_user.id, school_id=req.school_id, role=current_user.role)
    refresh_token = create_refresh_token(subject=current_user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(current_user)
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully logged out."}

