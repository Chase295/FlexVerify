from sqlalchemy import Column, String, Text, TIMESTAMP, Table, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.config.database import Base


# Association table for many-to-many User <-> Role
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
)


class Role(Base):
    """Role model for RBAC permissions"""
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)

    # Permissions as JSONB: {"persons.read": true, "persons.write": true, ...}
    permissions = Column(JSONB, default={})

    # Field visibility/editability
    visible_fields = Column(JSONB, default=[])  # Array of field UUIDs
    editable_fields = Column(JSONB, default=[])  # Array of field UUIDs

    # Scanner configuration as JSONB
    # Structure: {
    #   "enabled_modes": ["face", "qr", "barcode", "text"],
    #   "default_mode": "face",
    #   "text_search": {"enabled_fields": [...], "default_fields": [...], "max_results": 10},
    #   "face_recognition": {"show_confidence": true, "min_confidence": 70}
    # }
    scanner_config = Column(JSONB, default=None)

    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")

    def __repr__(self):
        return f"<Role {self.name}>"


# Default permissions structure
DEFAULT_PERMISSIONS = {
    # Dashboard Widgets
    "dashboard.view": False,
    "dashboard.stats": False,
    "dashboard.recent_persons": False,
    "dashboard.compliance_overview": False,
    "dashboard.expiring_documents": False,
    "dashboard.scan_activity": False,

    # Persons
    "persons.read": False,
    "persons.create": False,
    "persons.update": False,
    "persons.delete": False,

    # Fields
    "fields.read": False,
    "fields.create": False,
    "fields.update": False,
    "fields.delete": False,

    # Users
    "users.read": False,
    "users.create": False,
    "users.update": False,
    "users.delete": False,

    # Roles
    "roles.read": False,
    "roles.create": False,
    "roles.update": False,
    "roles.delete": False,

    # Documents
    "documents.read": False,
    "documents.upload": False,
    "documents.delete": False,

    # Recognition
    "recognition.face": False,
    # DISABLED: QR/Barcode recognition temporarily disabled
    # "recognition.qr": False,
    # "recognition.barcode": False,
    "recognition.text": False,

    # Audit
    "audit.read": False,
    "audit.export": False,

    # Settings
    "settings.read": False,
    "settings.update": False,
}


# Predefined role templates
ROLE_TEMPLATES = {
    "admin": {
        "name": "Administrator",
        "description": "Full access to all features",
        "permissions": {k: True for k in DEFAULT_PERMISSIONS}
    },
    "site_manager": {
        "name": "Site Manager",
        "description": "Manage persons and view reports",
        "permissions": {
            **DEFAULT_PERMISSIONS,
            # Dashboard
            "dashboard.view": True,
            "dashboard.stats": True,
            "dashboard.recent_persons": True,
            "dashboard.compliance_overview": True,
            "dashboard.expiring_documents": True,
            "dashboard.scan_activity": True,
            # Persons
            "persons.read": True,
            "persons.create": True,
            "persons.update": True,
            "fields.read": True,
            "documents.read": True,
            "documents.upload": True,
            "recognition.face": True,
            # DISABLED: QR/Barcode recognition temporarily disabled
            # "recognition.qr": True,
            # "recognition.barcode": True,
            "recognition.text": True,
            "audit.read": True,
        }
    },
    "inspector": {
        "name": "Inspector",
        "description": "View and scan persons, add notes",
        "permissions": {
            **DEFAULT_PERMISSIONS,
            # Dashboard (limited)
            "dashboard.view": True,
            "dashboard.stats": True,
            "dashboard.scan_activity": True,
            # Persons
            "persons.read": True,
            "persons.update": True,  # Limited to certain fields
            "fields.read": True,
            "documents.read": True,
            "recognition.face": True,
            # DISABLED: QR/Barcode recognition temporarily disabled
            # "recognition.qr": True,
            # "recognition.barcode": True,
            "recognition.text": True,
        }
    },
    "scanner": {
        "name": "Mobile Scanner",
        "description": "Read-only scanning access",
        "permissions": {
            **DEFAULT_PERMISSIONS,
            "persons.read": True,
            "fields.read": True,
            "recognition.face": True,
            # DISABLED: QR/Barcode recognition temporarily disabled
            # "recognition.qr": True,
            # "recognition.barcode": True,
            "recognition.text": True,
        }
    },
    "hr": {
        "name": "HR Manager",
        "description": "Manage person data and documents",
        "permissions": {
            **DEFAULT_PERMISSIONS,
            # Dashboard
            "dashboard.view": True,
            "dashboard.stats": True,
            "dashboard.recent_persons": True,
            "dashboard.compliance_overview": True,
            "dashboard.expiring_documents": True,
            # Persons
            "persons.read": True,
            "persons.create": True,
            "persons.update": True,
            "fields.read": True,
            "documents.read": True,
            "documents.upload": True,
            "documents.delete": True,
            "audit.read": True,
        }
    }
}
