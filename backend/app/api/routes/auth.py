from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    ChangePasswordRequest,
    RefreshRequest,
    TokenResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserProfileUpdateRequest,
    UserRegisterRequest,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token_value,
    get_user_by_email,
    get_user_by_id,
    get_valid_refresh_token,
    hash_password,
    revoke_all_user_refresh_tokens,
    revoke_refresh_token,
    store_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await db.get(Organization, body.organization_id)
    if not org or not org.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization not found")

    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        organization_id=body.organization_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserProfileResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: UserLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    access_token = create_access_token(user.id, user.organization_id, user.role)
    refresh_value = create_refresh_token_value()
    await store_refresh_token(db, user.id, refresh_value)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_value)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rt = await get_valid_refresh_token(db, body.refresh_token)
    if not rt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        )

    user = await get_user_by_id(db, rt.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")

    await revoke_refresh_token(db, body.refresh_token)
    access_token = create_access_token(user.id, user.organization_id, user.role)
    return AccessTokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    await revoke_refresh_token(db, body.refresh_token)


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    return UserProfileResponse.model_validate(current_user)


@router.patch("/me", response_model=UserProfileResponse)
async def update_me(
    body: UserProfileUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    if body.email and body.email != current_user.email:
        conflict = await get_user_by_email(db, body.email)
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        current_user.email = body.email

    if body.first_name is not None:
        current_user.first_name = body.first_name
    if body.last_name is not None:
        current_user.last_name = body.last_name

    await db.flush()
    await db.refresh(current_user)
    return UserProfileResponse.model_validate(current_user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )

    current_user.hashed_password = hash_password(body.new_password)
    await revoke_all_user_refresh_tokens(db, current_user.id)
    await db.flush()
