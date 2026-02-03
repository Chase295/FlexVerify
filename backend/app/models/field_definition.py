from sqlalchemy import Column, String, Boolean, Integer, TIMESTAMP, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.config.database import Base


class FieldDefinition(Base):
    """Dynamic field definition model"""
    __tablename__ = "field_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic info
    name = Column(String(255), nullable=False, unique=True)  # Internal name (e.g., "safety_shoes")
    label = Column(String(255), nullable=False)  # Display label (e.g., "Sicherheitsschuhe")
    description = Column(Text)

    # System field flag - system fields cannot be deleted, only configured
    is_system = Column(Boolean, default=False)

    # Field type: text, email, date, date_expiry, checkbox, dropdown, number, photo, document, qr_code, barcode
    field_type = Column(String(50), nullable=False)

    # Grouping
    category = Column(String(100))  # e.g., "Sicherheitsausrüstung", "Zertifikation"
    field_order = Column(Integer, default=0)  # Display order within category

    # Requirements
    is_required = Column(Boolean, default=False)
    is_searchable = Column(Boolean, default=False)  # Index for text search
    is_unique = Column(Boolean, default=False)  # Value must be unique across persons

    # Field-type specific configuration
    # Examples:
    # - text: {"max_length": 255, "regex": null, "placeholder": "Enter name"}
    # - dropdown: {"options": ["Option A", "Option B"], "multi_select": false}
    # - date_expiry: {"warning_days": 30, "critical_days": 7}
    # - number: {"min": 0, "max": 100, "decimal_places": 2, "unit": "kg"}
    # - photo/document: {"max_size_mb": 10, "formats": ["jpg", "png"]}
    configuration = Column(JSONB, default={})

    # Validation rules
    # {"min_value": 0, "max_value": 100, "regex": "^[A-Z0-9]+$"}
    validation_rules = Column(JSONB, default={})

    # Conditional logic / dependencies
    # {"show_when": {"field_id": "uuid", "operator": "equals", "value": "external"}}
    dependencies = Column(JSONB, default={})

    # Role-based visibility
    visible_to_roles = Column(JSONB, default=[])  # Empty = all roles
    editable_by_roles = Column(JSONB, default=[])  # Empty = all roles

    # Metadata
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<FieldDefinition {self.name} ({self.field_type})>"


# Supported field types with their configuration schemas
FIELD_TYPES = {
    "text": {
        "description": "Single-line text input",
        "config_schema": {
            "max_length": {"type": "integer", "default": 255},
            "regex": {"type": "string", "default": None},
            "placeholder": {"type": "string", "default": ""},
        }
    },
    "textarea": {
        "description": "Multi-line text input",
        "config_schema": {
            "max_length": {"type": "integer", "default": 5000},
            "rows": {"type": "integer", "default": 4},
            "placeholder": {"type": "string", "default": ""},
        }
    },
    "email": {
        "description": "Email address",
        "config_schema": {
            "unique": {"type": "boolean", "default": False},
        }
    },
    "number": {
        "description": "Numeric value",
        "config_schema": {
            "min": {"type": "number", "default": None},
            "max": {"type": "number", "default": None},
            "decimal_places": {"type": "integer", "default": 0},
            "unit": {"type": "string", "default": ""},
        }
    },
    "date": {
        "description": "Date picker",
        "config_schema": {
            "min_date": {"type": "string", "default": None},  # ISO format
            "max_date": {"type": "string", "default": None},
            "format": {"type": "string", "default": "YYYY-MM-DD"},
        }
    },
    "date_expiry": {
        "description": "Date with expiration tracking",
        "config_schema": {
            "warning_days": {"type": "integer", "default": 30},
            "critical_days": {"type": "integer", "default": 7},
            "auto_notify": {"type": "boolean", "default": False},
        }
    },
    "checkbox": {
        "description": "Boolean toggle",
        "config_schema": {
            "label_true": {"type": "string", "default": "Ja"},
            "label_false": {"type": "string", "default": "Nein"},
        }
    },
    "dropdown": {
        "description": "Single or multi-select dropdown",
        "config_schema": {
            "options": {"type": "array", "default": []},
            "multi_select": {"type": "boolean", "default": False},
            "allow_other": {"type": "boolean", "default": False},
        }
    },
    "photo": {
        "description": "Image upload",
        "config_schema": {
            "max_size_mb": {"type": "integer", "default": 10},
            "formats": {"type": "array", "default": ["jpg", "jpeg", "png"]},
            "min_width": {"type": "integer", "default": None},
            "min_height": {"type": "integer", "default": None},
        }
    },
    "document": {
        "description": "Document upload",
        "config_schema": {
            "max_size_mb": {"type": "integer", "default": 50},
            "formats": {"type": "array", "default": ["pdf", "doc", "docx"]},
        }
    },
    # DISABLED: QR/Barcode field types temporarily disabled
    # "qr_code": {
    #     "description": "QR code identifier",
    #     "config_schema": {
    #         "format": {"type": "string", "default": "auto"},
    #         "generate_on_create": {"type": "boolean", "default": False},
    #     }
    # },
    # "barcode": {
    #     "description": "Barcode identifier",
    #     "config_schema": {
    #         "format": {"type": "string", "default": "auto"},  # EAN-13, Code128, etc.
    #         "generate_on_create": {"type": "boolean", "default": False},
    #     }
    # },
}
