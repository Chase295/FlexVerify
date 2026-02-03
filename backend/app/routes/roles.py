"""
Role Management Routes
======================
CRUD operations for roles.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import logging

from app.config.database import get_db
from app.models.user import User
from app.models.role import Role, ROLE_TEMPLATES, DEFAULT_PERMISSIONS
from app.services.audit_service import AuditService
from app.middleware.auth import PermissionChecker
from app.schemas.user import (
    RoleCreate, RoleUpdate, RoleResponse, RoleDetailResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=List[RoleResponse])
async def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.read"))
):
    """List all roles"""
    roles = db.query(Role).all()
    return [RoleResponse.model_validate(r) for r in roles]


@router.get("/templates")
async def get_role_templates(
    current_user: User = Depends(PermissionChecker("roles.read"))
):
    """Get predefined role templates"""
    return {
        "templates": ROLE_TEMPLATES,
        "default_permissions": DEFAULT_PERMISSIONS
    }


@router.get("/{role_id}", response_model=RoleDetailResponse)
async def get_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.read"))
):
    """Get a role by ID"""
    role = db.query(Role).filter(Role.id == role_id).first()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return RoleDetailResponse.model_validate(role)


@router.post("", response_model=RoleDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.create"))
):
    """Create a new role"""
    # Check if name exists
    existing = db.query(Role).filter(Role.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name already exists"
        )

    # Create role
    role = Role(
        name=data.name,
        description=data.description,
        permissions=data.permissions or DEFAULT_PERMISSIONS,
        visible_fields=[str(f) for f in data.visible_fields],
        editable_fields=[str(f) for f in data.editable_fields],
        scanner_config=data.scanner_config.model_dump() if data.scanner_config else None
    )

    db.add(role)
    db.commit()
    db.refresh(role)

    # Audit log
    audit = AuditService(db)
    audit.log_create(
        user=current_user,
        resource_type="role",
        resource_id=role.id,
        new_value={"name": role.name}
    )

    logger.info(f"Role created: {role.name} by {current_user.email}")

    return RoleDetailResponse.model_validate(role)


@router.post("/from-template", response_model=RoleDetailResponse)
async def create_role_from_template(
    template_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.create"))
):
    """Create a role from a predefined template"""
    if template_key not in ROLE_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown template: {template_key}"
        )

    template = ROLE_TEMPLATES[template_key]

    # Check if name exists
    existing = db.query(Role).filter(Role.name == template["name"]).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this name already exists"
        )

    # Create role from template
    role = Role(
        name=template["name"],
        description=template["description"],
        permissions=template["permissions"],
        visible_fields=[],
        editable_fields=[]
    )

    db.add(role)
    db.commit()
    db.refresh(role)

    logger.info(f"Role created from template '{template_key}': {role.name}")

    return RoleDetailResponse.model_validate(role)


@router.put("/{role_id}", response_model=RoleDetailResponse)
async def update_role(
    role_id: UUID,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.update"))
):
    """Update a role"""
    role = db.query(Role).filter(Role.id == role_id).first()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Store old values for audit
    old_values = {"name": role.name, "permissions": role.permissions}

    # Update fields
    if data.name is not None:
        # Check if new name is taken
        existing = db.query(Role).filter(Role.name == data.name, Role.id != role_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role name already exists"
            )
        role.name = data.name

    if data.description is not None:
        role.description = data.description

    if data.permissions is not None:
        role.permissions = data.permissions

    if data.visible_fields is not None:
        role.visible_fields = [str(f) for f in data.visible_fields]

    if data.editable_fields is not None:
        role.editable_fields = [str(f) for f in data.editable_fields]

    if data.scanner_config is not None:
        role.scanner_config = data.scanner_config.model_dump()

    db.commit()
    db.refresh(role)

    # Audit log
    audit = AuditService(db)
    audit.log_update(
        user=current_user,
        resource_type="role",
        resource_id=role.id,
        old_value=old_values,
        new_value={"name": role.name, "permissions": role.permissions}
    )

    logger.info(f"Role updated: {role.name} by {current_user.email}")

    return RoleDetailResponse.model_validate(role)


@router.delete("/{role_id}")
async def delete_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.delete"))
):
    """Delete a role"""
    role = db.query(Role).filter(Role.id == role_id).first()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Check if role is in use
    if role.users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role is assigned to {len(role.users)} users and cannot be deleted"
        )

    # Audit log
    audit = AuditService(db)
    audit.log_delete(
        user=current_user,
        resource_type="role",
        resource_id=role.id,
        old_value={"name": role.name}
    )

    db.delete(role)
    db.commit()

    logger.info(f"Role deleted: {role.name} by {current_user.email}")

    return {"message": "Role deleted successfully"}
