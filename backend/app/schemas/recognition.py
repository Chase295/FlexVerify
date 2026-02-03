"""
Recognition Schemas
===================
Pydantic models for face/QR/text recognition.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class FaceSearchResponse(BaseModel):
    """Face recognition search response"""
    match: bool
    person: Optional["PersonMatchResponse"] = None
    confidence: Optional[float] = None
    best_distance: Optional[float] = None
    vector_types_tested: int = 0
    compliance_status: Optional["ComplianceCheckResponse"] = None
    reason: Optional[str] = None


class PersonMatchResponse(BaseModel):
    """Matched person info"""
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    personnel_number: Optional[str] = None
    photo_url: Optional[str] = None
    field_data: Dict[str, Any] = {}
    visible_field_labels: Optional[Dict[str, str]] = None  # Labels for visible fields

    class Config:
        from_attributes = True


class ComplianceCheckResponse(BaseModel):
    """Compliance check result"""
    status: str  # valid, warning, expired, pending
    is_compliant: bool
    warnings: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []


class QRLookupRequest(BaseModel):
    """QR code lookup request"""
    qr_code: str


class QRLookupResponse(BaseModel):
    """QR code lookup response"""
    found: bool
    person: Optional[PersonMatchResponse] = None
    compliance_status: Optional[ComplianceCheckResponse] = None
    reason: Optional[str] = None


class BarcodeLookupRequest(BaseModel):
    """Barcode lookup request"""
    barcode: str


class BarcodeLookupResponse(BaseModel):
    """Barcode lookup response"""
    found: bool
    person: Optional[PersonMatchResponse] = None
    compliance_status: Optional[ComplianceCheckResponse] = None
    reason: Optional[str] = None


class TextSearchRequest(BaseModel):
    """Text search request"""
    query: str = Field(..., min_length=1)
    fields: List[str] = ["first_name", "last_name", "personnel_number", "email"]
    limit: int = Field(default=10, ge=1, le=50)


class TextSearchResponse(BaseModel):
    """Text search response"""
    results: List[PersonMatchResponse]
    total: int
    query: str


class RecognitionSettingsResponse(BaseModel):
    """Recognition settings"""
    face_threshold: float
    face_threshold_percent: float
    model: str
    description: str


class RecognitionSettingsUpdate(BaseModel):
    """Update recognition settings"""
    face_threshold_percent: float = Field(..., ge=0, le=100)


# Update forward references
FaceSearchResponse.model_rebuild()
QRLookupResponse.model_rebuild()
BarcodeLookupResponse.model_rebuild()
