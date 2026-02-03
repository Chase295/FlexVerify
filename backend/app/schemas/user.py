"""
User Schemas
============
Pydantic models for user management.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


# Scanner Configuration Schemas
class ScannerTextSearchConfig(BaseModel):
    """Text search configuration for scanner"""
    enabled_fields: List[str] = ["last_name", "personnel_number", "email"]
    default_fields: List[str] = ["last_name"]
    max_results: int = 10


class ScannerFaceConfig(BaseModel):
    """Face recognition configuration for scanner"""
    show_confidence: bool = True
    min_confidence: int = 70


class ScannerConfig(BaseModel):
    """Complete scanner configuration for a role"""
    # DISABLED: QR/Barcode modes temporarily disabled - was ["face", "qr", "barcode", "text"]
    enabled_modes: List[str] = ["face", "text"]
    default_mode: str = "face"
    text_search: ScannerTextSearchConfig = ScannerTextSearchConfig()
    face_recognition: ScannerFaceConfig = ScannerFaceConfig()


class UserCreate(BaseModel):
    """Create a new user"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    role_ids: List[UUID] = []
    visible_fields: Optional[List[str]] = None  # User-specific field visibility
    editable_fields: Optional[List[str]] = None  # User-specific field editability


class UserUpdate(BaseModel):
    """Update user data"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role_ids: Optional[List[UUID]] = None
    visible_fields: Optional[List[str]] = None  # User-specific field visibility
    editable_fields: Optional[List[str]] = None  # User-specific field editability


class UserResponse(BaseModel):
    """User response"""
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    is_active: bool
    is_superadmin: bool
    created_at: datetime
    updated_at: datetime
    roles: List["RoleResponse"] = []
    visible_fields: Optional[List[str]] = None
    editable_fields: Optional[List[str]] = None

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Paginated user list"""
    items: List[UserResponse]
    total: int
    page: int
    page_size: int


# Role schemas (needed for UserResponse)
class RoleResponse(BaseModel):
    """Role response"""
    id: UUID
    name: str
    description: Optional[str]
    permissions: Optional[dict] = None

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    """Create a new role"""
    name: str = Field(..., min_length=2)
    description: Optional[str] = None
    permissions: dict = {}
    visible_fields: List[str] = []  # Field names or UUIDs as strings
    editable_fields: List[str] = []  # Field names or UUIDs as strings
    scanner_config: Optional[ScannerConfig] = None  # Scanner configuration


class RoleUpdate(BaseModel):
    """Update role"""
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[dict] = None
    visible_fields: Optional[List[str]] = None
    editable_fields: Optional[List[str]] = None
    scanner_config: Optional[ScannerConfig] = None  # Scanner configuration


class RoleDetailResponse(BaseModel):
    """Detailed role response"""
    id: UUID
    name: str
    description: Optional[str]
    permissions: dict
    visible_fields: List[str] = []
    editable_fields: List[str] = []
    scanner_config: Optional[Dict[str, Any]] = None  # Scanner configuration
    created_at: datetime

    class Config:
        from_attributes = True


# Update forward references
UserResponse.model_rebuild()
