"""
Authentication Routes
=====================
Login, register, token refresh endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import logging

from app.config.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.middleware.auth import get_current_active_user, get_superadmin_user
from app.schemas.auth import (
    LoginRequest, LoginResponse, RefreshRequest, RefreshResponse,
    RegisterRequest, ChangePasswordRequest, UserResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()
auth_service = AuthService()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login with email and password"""
    # Find user
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not auth_service.verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Create tokens
    tokens = auth_service.create_token_pair(str(user.id))

    # Audit log
    audit = AuditService(db)
    audit.log_login(
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    # Build user response
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active,
        is_superadmin=user.is_superadmin,
        roles=[{"id": r.id, "name": r.name} for r in user.roles]
    )

    logger.info(f"User logged in: {user.email}")

    return LoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=user_response
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(data: RefreshRequest):
    """Refresh access token using refresh token"""
    tokens = auth_service.refresh_tokens(data.refresh_token)

    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    return RefreshResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in
    )


@router.post("/register", response_model=UserResponse)
async def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_superadmin_user)
):
    """
    Register a new user (superadmin only).
    Regular users are created through the users endpoint.
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create user
    user = User(
        email=data.email,
        password_hash=auth_service.hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        is_active=True,
        is_superadmin=False
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"New user registered: {user.email}")

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active,
        is_superadmin=user.is_superadmin,
        roles=[]
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current authenticated user info"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        is_active=current_user.is_active,
        is_superadmin=current_user.is_superadmin,
        roles=[{"id": r.id, "name": r.name} for r in current_user.roles]
    )


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change current user's password"""
    # Verify current password
    if not auth_service.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update password
    current_user.password_hash = auth_service.hash_password(data.new_password)
    db.commit()

    logger.info(f"Password changed for user: {current_user.email}")

    return {"message": "Password changed successfully"}


@router.post("/logout")
async def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Logout (audit log only, tokens are stateless)"""
    audit = AuditService(db)
    audit.log_logout(
        user=current_user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    return {"message": "Logged out successfully"}
