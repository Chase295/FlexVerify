"""
Field Service
=============
Handles dynamic field definition management and validation.
"""

from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
from uuid import UUID
import re
from datetime import datetime, date
import logging

from app.models.field_definition import FieldDefinition, FIELD_TYPES
from app.models.user import User

logger = logging.getLogger(__name__)


class FieldService:
    """Service for field definition management"""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[FieldDefinition]:
        """Get all field definitions ordered by category and order"""
        return self.db.query(FieldDefinition)\
            .order_by(FieldDefinition.category, FieldDefinition.field_order)\
            .all()

    def get_by_id(self, field_id: UUID) -> Optional[FieldDefinition]:
        """Get a field definition by ID"""
        return self.db.query(FieldDefinition).filter(FieldDefinition.id == field_id).first()

    def get_by_name(self, name: str) -> Optional[FieldDefinition]:
        """Get a field definition by name"""
        return self.db.query(FieldDefinition).filter(FieldDefinition.name == name).first()

    def get_visible_fields(self, user: User) -> List[FieldDefinition]:
        """Get all fields visible to a user"""
        all_fields = self.get_all()

        if user.is_superadmin:
            return all_fields

        user_role_ids = {str(role.id) for role in user.roles}

        visible_fields = []
        for field in all_fields:
            # If no roles specified, visible to all
            if not field.visible_to_roles:
                visible_fields.append(field)
            # Otherwise, check if user has any of the required roles
            elif any(str(role_id) in user_role_ids for role_id in field.visible_to_roles):
                visible_fields.append(field)

        return visible_fields

    def get_editable_fields(self, user: User) -> List[FieldDefinition]:
        """Get all fields editable by a user"""
        all_fields = self.get_all()

        if user.is_superadmin:
            return all_fields

        user_role_ids = {str(role.id) for role in user.roles}

        editable_fields = []
        for field in all_fields:
            # If no roles specified, editable by all
            if not field.editable_by_roles:
                editable_fields.append(field)
            # Otherwise, check if user has any of the required roles
            elif any(str(role_id) in user_role_ids for role_id in field.editable_by_roles):
                editable_fields.append(field)

        return editable_fields

    def get_required_fields(self) -> List[FieldDefinition]:
        """Get all required field definitions (excluding system fields which are validated separately)"""
        return self.db.query(FieldDefinition)\
            .filter(FieldDefinition.is_required == True)\
            .filter(FieldDefinition.is_system == False)\
            .all()

    def get_searchable_fields(self) -> List[FieldDefinition]:
        """Get all searchable field definitions"""
        return self.db.query(FieldDefinition)\
            .filter(FieldDefinition.is_searchable == True)\
            .all()

    def get_categories(self) -> List[str]:
        """Get list of unique categories"""
        result = self.db.query(FieldDefinition.category)\
            .distinct()\
            .filter(FieldDefinition.category.isnot(None))\
            .all()
        return [r[0] for r in result]

    def create(self, data: dict) -> FieldDefinition:
        """Create a new field definition"""
        field = FieldDefinition(**data)
        self.db.add(field)
        self.db.commit()
        self.db.refresh(field)
        return field

    def update(self, field_id: UUID, data: dict) -> Optional[FieldDefinition]:
        """Update a field definition"""
        field = self.get_by_id(field_id)
        if not field:
            return None

        for key, value in data.items():
            if hasattr(field, key) and value is not None:
                setattr(field, key, value)

        self.db.commit()
        self.db.refresh(field)
        return field

    def delete(self, field_id: UUID) -> bool:
        """Delete a field definition"""
        field = self.get_by_id(field_id)
        if not field:
            return False

        self.db.delete(field)
        self.db.commit()
        return True

    def validate_value(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """
        Validate a value against a field definition.
        Returns {"valid": bool, "error": str or None, "value": processed_value}
        """
        # Handle None/empty values
        if value is None or value == "":
            if field.is_required:
                return {"valid": False, "error": f"Field '{field.label}' is required", "value": None}
            return {"valid": True, "error": None, "value": None}

        # Type-specific validation
        validator = getattr(self, f"_validate_{field.field_type}", None)
        if validator:
            return validator(field, value)

        # Default: accept any value
        return {"valid": True, "error": None, "value": value}

    def _validate_text(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate text field"""
        value = str(value)
        config = field.configuration or {}

        max_length = config.get("max_length", 255)
        if len(value) > max_length:
            return {"valid": False, "error": f"Text exceeds maximum length of {max_length}", "value": value}

        regex = config.get("regex")
        if regex and not re.match(regex, value):
            return {"valid": False, "error": f"Text does not match required format", "value": value}

        return {"valid": True, "error": None, "value": value}

    def _validate_textarea(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate textarea field"""
        return self._validate_text(field, value)

    def _validate_email(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate email field"""
        value = str(value)
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, value):
            return {"valid": False, "error": "Invalid email format", "value": value}
        return {"valid": True, "error": None, "value": value}

    def _validate_number(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate number field"""
        try:
            value = float(value)
        except (ValueError, TypeError):
            return {"valid": False, "error": "Invalid number", "value": value}

        config = field.configuration or {}
        min_val = config.get("min")
        max_val = config.get("max")

        if min_val is not None and value < min_val:
            return {"valid": False, "error": f"Value must be at least {min_val}", "value": value}
        if max_val is not None and value > max_val:
            return {"valid": False, "error": f"Value must be at most {max_val}", "value": value}

        return {"valid": True, "error": None, "value": value}

    def _validate_date(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate date field"""
        if isinstance(value, (date, datetime)):
            value = value.isoformat()

        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return {"valid": False, "error": "Invalid date format (use ISO format)", "value": value}

        return {"valid": True, "error": None, "value": value}

    def _validate_date_expiry(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate date_expiry field"""
        result = self._validate_date(field, value)
        if not result["valid"]:
            return result

        # Additional expiry checking is done in ValidationService
        return result

    def _validate_checkbox(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate checkbox field"""
        if isinstance(value, bool):
            return {"valid": True, "error": None, "value": value}
        if str(value).lower() in ("true", "1", "yes", "ja"):
            return {"valid": True, "error": None, "value": True}
        if str(value).lower() in ("false", "0", "no", "nein"):
            return {"valid": True, "error": None, "value": False}
        return {"valid": False, "error": "Invalid boolean value", "value": value}

    def _validate_dropdown(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate dropdown field"""
        config = field.configuration or {}
        options = config.get("options", [])
        multi_select = config.get("multi_select", False)
        allow_other = config.get("allow_other", False)

        if multi_select:
            if not isinstance(value, list):
                value = [value]
            if not allow_other:
                for v in value:
                    if v not in options:
                        return {"valid": False, "error": f"Invalid option: {v}", "value": value}
        else:
            if not allow_other and value not in options:
                return {"valid": False, "error": f"Invalid option: {value}", "value": value}

        return {"valid": True, "error": None, "value": value}

    def _validate_qr_code(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate QR code field"""
        return {"valid": True, "error": None, "value": str(value)}

    def _validate_barcode(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """Validate barcode field"""
        return {"valid": True, "error": None, "value": str(value)}

    def evaluate_dependencies(self, field_data: dict) -> Dict[str, bool]:
        """
        Evaluate field dependencies and return visibility map.
        Returns {field_id: is_visible}
        """
        all_fields = self.get_all()
        visibility = {}

        for field in all_fields:
            visibility[str(field.id)] = True  # Default visible

            dependencies = field.dependencies or {}
            show_when = dependencies.get("show_when")

            if show_when:
                target_field_id = show_when.get("field_id")
                operator = show_when.get("operator", "equals")
                expected_value = show_when.get("value")

                actual_value = field_data.get(str(target_field_id))

                # Evaluate condition
                is_visible = self._evaluate_condition(actual_value, operator, expected_value)
                visibility[str(field.id)] = is_visible

        return visibility

    def _evaluate_condition(self, actual: Any, operator: str, expected: Any) -> bool:
        """Evaluate a single condition"""
        if operator == "equals":
            return actual == expected
        elif operator == "not_equals":
            return actual != expected
        elif operator == "contains":
            return expected in str(actual) if actual else False
        elif operator == "greater_than":
            try:
                return float(actual) > float(expected)
            except:
                return False
        elif operator == "less_than":
            try:
                return float(actual) < float(expected)
            except:
                return False
        elif operator == "is_empty":
            return actual is None or actual == "" or actual == []
        elif operator == "is_not_empty":
            return actual is not None and actual != "" and actual != []
        return True
