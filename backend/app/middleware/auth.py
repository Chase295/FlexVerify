"""
Authentication Middleware
=========================
JWT verification and permission checking.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from functools import wraps
import logging

from app.config.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

# HTTP Bearer scheme for JWT
security = HTTPBearer(auto_error=False)
auth_service = AuthService()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get the current user from JWT token.
    Returns None if no valid token provided.
    """
    if not credentials:
        return None

    token = credentials.credentials
    user_id = auth_service.verify_access_token(token)

    if not user_id:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    return user


async def get_current_active_user(
    current_user: Optional[User] = Depends(get_current_user)
) -> User:
    """
    Require an authenticated active user.
    Raises 401 if not authenticated or user is inactive.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    return current_user


async def get_superadmin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Require a superadmin user.
    Raises 403 if user is not superadmin.
    """
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    return current_user


def require_permission(permission: str):
    """
    Decorator to require a specific permission.

    Usage:
        @router.get("/protected")
        @require_permission("persons.read")
        async def protected_route(current_user: User = Depends(get_current_active_user)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current_user from kwargs (injected by FastAPI)
            current_user = kwargs.get("current_user")

            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated"
                )

            if not current_user.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


class PermissionChecker:
    """
    Dependency class for checking permissions.

    Usage:
        @router.get("/protected")
        async def protected(
            current_user: User = Depends(PermissionChecker("persons.read"))
        ):
            ...
    """

    def __init__(self, permission: str):
        self.permission = permission

    async def __call__(
        self,
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if not current_user.has_permission(self.permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{self.permission}' required"
            )
        return current_user
