"""
Document Routes
===============
File upload and download endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import os
import logging
from datetime import datetime

from app.config.database import get_db
from app.config.settings import settings
from app.models.user import User
from app.models.person import Person
from app.models.document import Document
from app.services.audit_service import AuditService
from app.middleware.auth import PermissionChecker

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    person_id: UUID = Form(...),
    field_id: Optional[UUID] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("documents.upload"))
):
    """Upload a document for a person"""
    # Verify person exists
    person = db.query(Person).filter(Person.id == person_id, Person.deleted_at.is_(None)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Validate file type
    if file.content_type:
        mime_type = file.content_type
        ext = file.filename.split('.')[-1].lower() if file.filename else ''

        # Check allowed formats
        allowed_formats = settings.ALLOWED_DOCUMENT_FORMATS + settings.ALLOWED_IMAGE_FORMATS
        if ext not in allowed_formats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed: {', '.join(allowed_formats)}"
            )
    else:
        mime_type = "application/octet-stream"

    # Read file
    file_content = await file.read()
    file_size = len(file_content)

    # Check file size
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    # Create upload directory
    upload_dir = os.path.join(settings.UPLOAD_DIR, "documents", str(person_id))
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)

    # Check for existing document (same field) for versioning
    version = 1
    if field_id:
        existing = db.query(Document)\
            .filter(Document.person_id == person_id, Document.field_id == field_id, Document.deleted_at.is_(None))\
            .order_by(Document.version.desc())\
            .first()
        if existing:
            version = existing.version + 1

    # Create document record
    document = Document(
        person_id=person_id,
        field_id=field_id,
        file_name=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        version=version,
        uploaded_by=current_user.id
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    # Audit log
    audit = AuditService(db)
    audit.log_create(
        user=current_user,
        resource_type="document",
        resource_id=document.id,
        new_value={"file_name": document.file_name, "person_id": str(person_id)}
    )

    logger.info(f"Document uploaded: {document.file_name} for person {person_id}")

    return {
        "id": document.id,
        "file_name": document.file_name,
        "file_size": document.file_size,
        "mime_type": document.mime_type,
        "version": document.version,
        "uploaded_at": document.uploaded_at.isoformat()
    }


@router.get("/{document_id}")
async def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("documents.read"))
):
    """Download a document"""
    document = db.query(Document).filter(Document.id == document_id, Document.deleted_at.is_(None)).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        document.file_path,
        filename=document.file_name,
        media_type=document.mime_type or "application/octet-stream"
    )


@router.get("/{document_id}/info")
async def get_document_info(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("documents.read"))
):
    """Get document metadata"""
    document = db.query(Document).filter(Document.id == document_id, Document.deleted_at.is_(None)).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": document.id,
        "person_id": document.person_id,
        "field_id": document.field_id,
        "file_name": document.file_name,
        "file_size": document.file_size,
        "mime_type": document.mime_type,
        "version": document.version,
        "uploaded_by": document.uploaded_by,
        "uploaded_at": document.uploaded_at.isoformat()
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("documents.delete"))
):
    """Soft delete a document"""
    document = db.query(Document).filter(Document.id == document_id, Document.deleted_at.is_(None)).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Soft delete
    document.deleted_at = datetime.utcnow()
    db.commit()

    # Audit log
    audit = AuditService(db)
    audit.log_delete(
        user=current_user,
        resource_type="document",
        resource_id=document.id,
        old_value={"file_name": document.file_name}
    )

    logger.info(f"Document deleted: {document.file_name}")

    return {"message": "Document deleted successfully"}


@router.get("/person/{person_id}")
async def list_person_documents(
    person_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("documents.read"))
):
    """List all documents for a person"""
    documents = db.query(Document)\
        .filter(Document.person_id == person_id, Document.deleted_at.is_(None))\
        .order_by(Document.uploaded_at.desc())\
        .all()

    return [
        {
            "id": doc.id,
            "field_id": doc.field_id,
            "file_name": doc.file_name,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "version": doc.version,
            "uploaded_at": doc.uploaded_at.isoformat()
        }
        for doc in documents
    ]
