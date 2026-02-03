"""
Field Definition Schemas
========================
Pydantic models for dynamic field configuration.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


class FieldCreate(BaseModel):
    """Create a new field definition"""
    name: str = Field(..., min_length=1, max_length=255)
    label: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    # DISABLED: QR/Barcode field types temporarily disabled - was: qr_code|barcode
    field_type: str = Field(..., pattern="^(text|textarea|email|number|date|date_expiry|checkbox|dropdown|photo|document)$")
    category: Optional[str] = None
    field_order: int = 0
    is_required: bool = False
    is_searchable: bool = False
    is_unique: bool = False
    configuration: Dict[str, Any] = {}
    validation_rules: Dict[str, Any] = {}
    dependencies: Dict[str, Any] = {}
    visible_to_roles: List[UUID] = []
    editable_by_roles: List[UUID] = []


class FieldUpdate(BaseModel):
    """Update a field definition"""
    name: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    field_order: Optional[int] = None
    is_required: Optional[bool] = None
    is_searchable: Optional[bool] = None
    is_unique: Optional[bool] = None
    configuration: Optional[Dict[str, Any]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    dependencies: Optional[Dict[str, Any]] = None
    visible_to_roles: Optional[List[UUID]] = None
    editable_by_roles: Optional[List[UUID]] = None


class FieldResponse(BaseModel):
    """Field definition response"""
    id: UUID
    name: str
    label: str
    description: Optional[str]
    field_type: str
    category: Optional[str]
    field_order: int
    is_required: bool
    is_searchable: bool
    is_unique: bool
    is_system: bool = False  # System fields cannot be deleted
    configuration: Dict[str, Any]
    validation_rules: Dict[str, Any]
    dependencies: Dict[str, Any]
    visible_to_roles: List[UUID]
    editable_by_roles: List[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FieldListResponse(BaseModel):
    """List of fields, optionally grouped by category"""
    items: List[FieldResponse]
    total: int


class FieldSchemaResponse(BaseModel):
    """Complete field schema for frontend form rendering"""
    fields: List[FieldResponse]
    categories: List[str]
    field_types: Dict[str, Any]


class DependencyRule(BaseModel):
    """Field dependency rule"""
    field_id: UUID
    operator: str = Field(..., pattern="^(equals|not_equals|contains|greater_than|less_than|is_empty|is_not_empty)$")
    value: Any


class FieldDependency(BaseModel):
    """Field visibility dependency"""
    show_when: Optional[DependencyRule] = None
    hide_when: Optional[DependencyRule] = None
    require_when: Optional[DependencyRule] = None
