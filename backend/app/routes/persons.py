"""
Person Management Routes
========================
CRUD operations for persons.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
import logging

from app.config.database import get_db
from app.models.user import User
from app.models.person import Person
from app.services.person_service import PersonService
from app.services.validation_service import ValidationService
from app.services.audit_service import AuditService
from app.middleware.auth import PermissionChecker, get_current_active_user
from app.schemas.person import (
    PersonCreate, PersonUpdate, PersonResponse, PersonListResponse,
    PersonDetailResponse, ComplianceStatusResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/stats")
async def get_person_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.read"))
):
    """Get person statistics including compliance counts"""
    from sqlalchemy import func

    # Total and active counts
    total_persons = db.query(func.count(Person.id)).filter(Person.is_active == True).scalar() or 0

    # Compliance counts grouped by status
    compliance_counts = db.query(
        Person.compliance_status,
        func.count(Person.id)
    ).filter(
        Person.is_active == True
    ).group_by(
        Person.compliance_status
    ).all()

    # Convert to dict
    counts_dict = {status: count for status, count in compliance_counts}

    return {
        "total_persons": total_persons,
        "active_persons": total_persons,
        "compliance_valid": counts_dict.get("valid", 0),
        "compliance_warning": counts_dict.get("warning", 0),
        "compliance_expired": counts_dict.get("expired", 0),
        "compliance_pending": counts_dict.get("pending", 0),
    }


@router.get("", response_model=PersonListResponse)
async def list_persons(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    compliance_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.read"))
):
    """List all persons with filtering and pagination"""
    person_service = PersonService(db)

    persons, total = person_service.get_all(
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
        compliance_status=compliance_status
    )

    return PersonListResponse(
        items=[PersonResponse.from_orm_with_extras(p) for p in persons],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{person_id}", response_model=PersonDetailResponse)
async def get_person(
    person_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.read"))
):
    """Get a person by ID with full details"""
    person_service = PersonService(db)
    person = person_service.get_by_id(person_id)

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Get documents and recent scans
    documents = person.documents[:10] if person.documents else []
    recent_scans = person.scan_events[:10] if person.scan_events else []

    response = PersonResponse.from_orm_with_extras(person)
    return PersonDetailResponse(
        **response.model_dump(),
        documents=documents,
        recent_scans=recent_scans
    )


@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    data: PersonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.create"))
):
    """Create a new person"""
    person_service = PersonService(db)

    try:
        person = person_service.create(data.model_dump(), created_by=current_user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Audit log
    audit = AuditService(db)
    audit.log_create(
        user=current_user,
        resource_type="person",
        resource_id=person.id,
        new_value={"name": person.full_name}
    )

    logger.info(f"Person created: {person.full_name} by {current_user.email}")

    return PersonResponse.from_orm_with_extras(person)


@router.put("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: UUID,
    data: PersonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.update"))
):
    """Update a person"""
    person_service = PersonService(db)
    person = person_service.get_by_id(person_id)

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Store old values for audit
    old_values = {"name": person.full_name, "field_data": person.field_data}

    try:
        updated = person_service.update(person_id, data.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Audit log
    audit = AuditService(db)
    audit.log_update(
        user=current_user,
        resource_type="person",
        resource_id=person.id,
        old_value=old_values,
        new_value={"name": updated.full_name, "field_data": updated.field_data}
    )

    logger.info(f"Person updated: {updated.full_name} by {current_user.email}")

    return PersonResponse.from_orm_with_extras(updated)


@router.delete("/{person_id}")
async def delete_person(
    person_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.delete"))
):
    """Soft delete a person"""
    person_service = PersonService(db)
    person = person_service.get_by_id(person_id)

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Audit log
    audit = AuditService(db)
    audit.log_delete(
        user=current_user,
        resource_type="person",
        resource_id=person.id,
        old_value={"name": person.full_name}
    )

    person_service.delete(person_id)

    logger.info(f"Person deleted: {person.full_name} by {current_user.email}")

    return {"message": "Person deleted successfully"}


@router.post("/{person_id}/photo", response_model=PersonResponse)
async def upload_photo(
    person_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.update"))
):
    """Upload or update a person's photo"""
    person_service = PersonService(db)
    person = person_service.get_by_id(person_id)

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # Read and process photo
    photo_data = await file.read()

    updated = person_service.update_photo(person_id, photo_data)

    # Audit log
    audit = AuditService(db)
    audit.log_update(
        user=current_user,
        resource_type="person",
        resource_id=person.id,
        old_value={},
        new_value={"photo_updated": True, "has_vectors": updated.has_face_vectors()}
    )

    logger.info(f"Photo uploaded for {updated.full_name} by {current_user.email}")

    return PersonResponse.from_orm_with_extras(updated)


@router.get("/{person_id}/compliance", response_model=ComplianceStatusResponse)
async def get_compliance_status(
    person_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.read"))
):
    """Get compliance status for a person"""
    person_service = PersonService(db)
    person = person_service.get_by_id(person_id)

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    validation_service = ValidationService(db)
    result = validation_service.validate_person(person)

    return ComplianceStatusResponse(**result)


@router.get("/{person_id}/photo")
async def get_photo(
    person_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.read"))
):
    """Get a person's photo"""
    from fastapi.responses import FileResponse
    import os

    person_service = PersonService(db)
    person = person_service.get_by_id(person_id)

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    if not person.profile_photo_path or not os.path.exists(person.profile_photo_path):
        raise HTTPException(status_code=404, detail="Photo not found")

    return FileResponse(
        person.profile_photo_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"}
    )


@router.post("/bulk-update")
async def bulk_update_field(
    person_ids: List[UUID],
    field_id: UUID,
    value: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("persons.update"))
):
    """Update a field value for multiple persons"""
    person_service = PersonService(db)
    audit = AuditService(db)

    updated_count = 0
    for person_id in person_ids:
        person = person_service.get_by_id(person_id)
        if person:
            field_data = person.field_data or {}
            field_data[str(field_id)] = value
            person_service.update(person_id, {"field_data": field_data})
            updated_count += 1

    logger.info(f"Bulk update: {updated_count} persons updated by {current_user.email}")

    return {"message": f"Updated {updated_count} persons"}
