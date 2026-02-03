"""
Person Schemas
==============
Pydantic models for person management.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class PersonCreate(BaseModel):
    """Create a new person"""
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    personnel_number: Optional[str] = None
    qr_code: Optional[str] = None
    barcode: Optional[str] = None
    field_data: Dict[str, Any] = {}


class PersonUpdate(BaseModel):
    """Update a person"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    personnel_number: Optional[str] = None
    qr_code: Optional[str] = None
    barcode: Optional[str] = None
    field_data: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class PersonResponse(BaseModel):
    """Person response"""
    id: UUID
    first_name: str
    last_name: str
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    personnel_number: Optional[str]
    qr_code: Optional[str]
    barcode: Optional[str]
    field_data: Dict[str, Any]
    has_photo: bool
    has_face_vectors: bool
    is_active: bool
    compliance_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_extras(cls, person):
        """Create response from ORM model with computed fields"""
        return cls(
            id=person.id,
            first_name=person.first_name,
            last_name=person.last_name,
            full_name=person.full_name,
            email=person.email,
            phone=person.phone,
            personnel_number=person.personnel_number,
            qr_code=person.qr_code,
            barcode=person.barcode,
            field_data=person.field_data or {},
            has_photo=bool(person.profile_photo_path),
            has_face_vectors=person.has_face_vectors(),
            is_active=person.is_active,
            compliance_status=person.compliance_status,
            created_at=person.created_at,
            updated_at=person.updated_at
        )


class PersonListResponse(BaseModel):
    """Paginated person list"""
    items: List[PersonResponse]
    total: int
    page: int
    page_size: int


class PersonDetailResponse(PersonResponse):
    """Detailed person response with documents"""
    documents: List["DocumentResponse"] = []
    recent_scans: List["ScanEventResponse"] = []


class ComplianceStatusResponse(BaseModel):
    """Compliance validation result"""
    status: str  # valid, warning, expired, pending
    is_compliant: bool
    warnings: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    checked_at: datetime


class DocumentResponse(BaseModel):
    """Document response"""
    id: UUID
    file_name: str
    file_size: Optional[int]
    mime_type: Optional[str]
    version: int
    uploaded_at: datetime
    field_id: Optional[UUID]

    class Config:
        from_attributes = True


class ScanEventResponse(BaseModel):
    """Scan event response"""
    id: UUID
    search_method: str
    confidence: Optional[float]
    result: str
    created_at: datetime

    class Config:
        from_attributes = True


# Update forward references
PersonDetailResponse.model_rebuild()
