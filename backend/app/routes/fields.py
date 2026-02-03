"""
Field Definition Routes
=======================
CRUD operations for dynamic field definitions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import logging

from app.config.database import get_db
from app.models.user import User
from app.models.field_definition import FieldDefinition, FIELD_TYPES
from app.services.field_service import FieldService
from app.services.audit_service import AuditService
from app.middleware.auth import PermissionChecker, get_current_active_user
from app.schemas.field import (
    FieldCreate, FieldUpdate, FieldResponse, FieldListResponse, FieldSchemaResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=FieldListResponse)
async def list_fields(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all field definitions visible to current user"""
    field_service = FieldService(db)
    fields = field_service.get_visible_fields(current_user)

    return FieldListResponse(
        items=[FieldResponse.model_validate(f) for f in fields],
        total=len(fields)
    )


@router.get("/schema", response_model=FieldSchemaResponse)
async def get_field_schema(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get complete field schema for form rendering"""
    field_service = FieldService(db)
    fields = field_service.get_visible_fields(current_user)
    categories = field_service.get_categories()

    return FieldSchemaResponse(
        fields=[FieldResponse.model_validate(f) for f in fields],
        categories=categories,
        field_types=FIELD_TYPES
    )


@router.get("/types")
async def get_field_types(
    current_user: User = Depends(get_current_active_user)
):
    """Get available field types and their configuration schemas"""
    return FIELD_TYPES


@router.get("/all-person-fields")
async def get_all_person_fields(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("fields.read"))
):
    """Get all available person fields (standard + dynamic) for field permission configuration"""
    # Standard fields of Person model
    # DISABLED: QR/Barcode fields temporarily disabled
    # {"id": "qr_code", "name": "qr_code", "label": "QR-Code", "type": "standard"},
    # {"id": "barcode", "name": "barcode", "label": "Barcode", "type": "standard"},
    standard_fields = [
        {"id": "first_name", "name": "first_name", "label": "Vorname", "type": "standard"},
        {"id": "last_name", "name": "last_name", "label": "Nachname", "type": "standard"},
        {"id": "email", "name": "email", "label": "E-Mail", "type": "standard"},
        {"id": "phone", "name": "phone", "label": "Telefon", "type": "standard"},
        {"id": "personnel_number", "name": "personnel_number", "label": "Personalnummer", "type": "standard"},
    ]

    # Dynamic fields from database
    dynamic_fields = db.query(FieldDefinition).order_by(FieldDefinition.field_order).all()
    dynamic_list = [
        {
            "id": str(f.id),
            "name": f.name,
            "label": f.label,
            "type": "dynamic",
            "field_type": f.field_type,
            "category": f.category
        }
        for f in dynamic_fields
    ]

    return {
        "standard_fields": standard_fields,
        "dynamic_fields": dynamic_list
    }


@router.get("/categories")
async def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of field categories"""
    field_service = FieldService(db)
    return field_service.get_categories()


@router.get("/{field_id}", response_model=FieldResponse)
async def get_field(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("fields.read"))
):
    """Get a field definition by ID"""
    field_service = FieldService(db)
    field = field_service.get_by_id(field_id)

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    return FieldResponse.model_validate(field)


@router.post("", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
async def create_field(
    data: FieldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("fields.create"))
):
    """Create a new field definition"""
    field_service = FieldService(db)

    # Check if name already exists
    existing = field_service.get_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field name already exists"
        )

    # Validate field type
    if data.field_type not in FIELD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field type: {data.field_type}"
        )

    # Create field
    field = field_service.create(data.model_dump())

    # Audit log
    audit = AuditService(db)
    audit.log_create(
        user=current_user,
        resource_type="field",
        resource_id=field.id,
        new_value={"name": field.name, "type": field.field_type}
    )

    logger.info(f"Field created: {field.name} ({field.field_type}) by {current_user.email}")

    return FieldResponse.model_validate(field)


@router.put("/{field_id}", response_model=FieldResponse)
async def update_field(
    field_id: UUID,
    data: FieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("fields.update"))
):
    """Update a field definition"""
    field_service = FieldService(db)
    field = field_service.get_by_id(field_id)

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    # Store old values for audit
    old_values = {"name": field.name, "label": field.label}

    # Check name uniqueness if changing
    if data.name and data.name != field.name:
        existing = field_service.get_by_name(data.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Field name already exists"
            )

    # Update field
    updated = field_service.update(field_id, data.model_dump(exclude_unset=True))

    # Audit log
    audit = AuditService(db)
    audit.log_update(
        user=current_user,
        resource_type="field",
        resource_id=field.id,
        old_value=old_values,
        new_value={"name": updated.name, "label": updated.label}
    )

    logger.info(f"Field updated: {updated.name} by {current_user.email}")

    return FieldResponse.model_validate(updated)


@router.delete("/{field_id}")
async def delete_field(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("fields.delete"))
):
    """Delete a field definition"""
    field_service = FieldService(db)
    field = field_service.get_by_id(field_id)

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    # System fields cannot be deleted
    if field.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Systemfelder können nicht gelöscht werden"
        )

    # Audit log
    audit = AuditService(db)
    audit.log_delete(
        user=current_user,
        resource_type="field",
        resource_id=field.id,
        old_value={"name": field.name, "type": field.field_type}
    )

    field_service.delete(field_id)

    logger.info(f"Field deleted: {field.name} by {current_user.email}")

    return {"message": "Field deleted successfully"}


@router.post("/reorder")
async def reorder_fields(
    field_orders: List[dict],  # [{"id": uuid, "order": int}, ...]
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("fields.update"))
):
    """Reorder fields within categories"""
    field_service = FieldService(db)

    for item in field_orders:
        field = field_service.get_by_id(item["id"])
        if field:
            field.field_order = item["order"]

    db.commit()

    logger.info(f"Fields reordered by {current_user.email}")

    return {"message": "Fields reordered successfully"}
