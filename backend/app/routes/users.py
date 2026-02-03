"""
User Management Routes
======================
CRUD operations for users.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import logging

from app.config.database import get_db
from app.models.user import User
from app.models.role import Role
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.middleware.auth import get_current_active_user, PermissionChecker
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserListResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()
auth_service = AuthService()


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.read"))
):
    """List all users with pagination"""
    query = db.query(User)

    total = query.count()
    offset = (page - 1) * page_size
    users = query.offset(offset).limit(page_size).all()

    return UserListResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.read"))
):
    """Get a user by ID"""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.create"))
):
    """Create a new user"""
    # Check if email exists
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
        is_superadmin=False,
        visible_fields=data.visible_fields,
        editable_fields=data.editable_fields
    )

    # Assign roles
    if data.role_ids:
        roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
        user.roles = roles

    db.add(user)
    db.commit()
    db.refresh(user)

    # Audit log
    audit = AuditService(db)
    audit.log_create(
        user=current_user,
        resource_type="user",
        resource_id=user.id,
        new_value={"email": user.email, "full_name": user.full_name}
    )

    logger.info(f"User created: {user.email} by {current_user.email}")

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.update"))
):
    """Update a user"""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Store old values for audit
    old_values = {
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active
    }

    # Update fields
    if data.email is not None:
        # Check if new email is taken
        existing = db.query(User).filter(User.email == data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        user.email = data.email

    if data.full_name is not None:
        user.full_name = data.full_name

    if data.phone is not None:
        user.phone = data.phone

    if data.is_active is not None:
        user.is_active = data.is_active

    # Update roles
    if data.role_ids is not None:
        if data.role_ids:  # Non-empty list
            roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
            user.roles = roles
        else:  # Empty list = remove all roles
            user.roles = []

    # Update field permissions
    if data.visible_fields is not None:
        user.visible_fields = data.visible_fields if data.visible_fields else None

    if data.editable_fields is not None:
        user.editable_fields = data.editable_fields if data.editable_fields else None

    db.commit()
    db.refresh(user)

    # Audit log
    audit = AuditService(db)
    audit.log_update(
        user=current_user,
        resource_type="user",
        resource_id=user.id,
        old_value=old_values,
        new_value={"email": user.email, "full_name": user.full_name, "is_active": user.is_active}
    )

    logger.info(f"User updated: {user.email} by {current_user.email}")

    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.delete"))
):
    """Deactivate a user (soft delete)"""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    if user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete superadmin account"
        )

    # Soft delete (deactivate)
    user.is_active = False
    db.commit()

    # Audit log
    audit = AuditService(db)
    audit.log_delete(
        user=current_user,
        resource_type="user",
        resource_id=user.id,
        old_value={"email": user.email, "full_name": user.full_name}
    )

    logger.info(f"User deactivated: {user.email} by {current_user.email}")

    return {"message": "User deactivated successfully"}
