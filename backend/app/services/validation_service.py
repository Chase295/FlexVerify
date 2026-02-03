"""
Validation Service
==================
Handles compliance validation for persons with flexible compliance rules.
"""

from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta
import logging

from app.models.person import Person
from app.models.field_definition import FieldDefinition
from app.services.field_service import FieldService

logger = logging.getLogger(__name__)


class ValidationService:
    """Service for compliance validation with flexible rules"""

    def __init__(self, db: Session):
        self.db = db
        self.field_service = FieldService(db)

    def validate_person(self, person: Person) -> Dict[str, Any]:
        """
        Validate a person's compliance status.

        Returns:
        {
            "status": "valid" | "warning" | "expired",
            "is_compliant": bool,
            "warnings": [{"field_id": ..., "message": ..., "days_until_expiry": ...}],
            "errors": [{"field_id": ..., "message": ...}],
            "checked_at": datetime
        }
        """
        warnings = []
        errors = []

        # Get all non-system fields
        all_fields = self.field_service.get_all()
        field_data = person.field_data or {}

        for field in all_fields:
            # Skip system fields (validated separately via model attributes)
            if field.is_system:
                continue

            field_id_str = str(field.id)
            value = field_data.get(field_id_str)
            config = field.configuration or {}
            has_compliance_rules = bool(config.get("compliance_rules"))

            # Skip fields without requirements and without compliance rules
            if not field.is_required and not has_compliance_rules:
                continue

            # Check if required field is present
            if field.is_required and (value is None or value == ""):
                errors.append({
                    "field_id": field_id_str,
                    "field_name": field.name,
                    "field_label": field.label,
                    "message": f"Required field '{field.label}' is missing"
                })
                continue

            # Validate value format
            if value is not None and value != "":
                validation_result = self.field_service.validate_value(field, value)
                if not validation_result["valid"]:
                    errors.append({
                        "field_id": field_id_str,
                        "field_name": field.name,
                        "field_label": field.label,
                        "message": validation_result["error"]
                    })
                    continue

            # Check compliance rules if defined
            if has_compliance_rules and value is not None and value != "":
                rule_result = self._evaluate_compliance_rule(field, value)
                if rule_result["status"] == "error":
                    errors.append({
                        "field_id": field_id_str,
                        "field_name": field.name,
                        "field_label": field.label,
                        "message": rule_result["message"],
                        "days_overdue": rule_result.get("days_overdue")
                    })
                elif rule_result["status"] == "warning":
                    warnings.append({
                        "field_id": field_id_str,
                        "field_name": field.name,
                        "field_label": field.label,
                        "message": rule_result["message"],
                        "days_until_expiry": rule_result.get("days_until")
                    })

            # Legacy: Check expiry for date_expiry fields (backward compatibility)
            elif field.field_type == "date_expiry" and value:
                expiry_check = self._check_expiry(field, value)
                if expiry_check:
                    if expiry_check["is_expired"]:
                        errors.append({
                            "field_id": field_id_str,
                            "field_name": field.name,
                            "field_label": field.label,
                            "message": f"'{field.label}' has expired",
                            "expired_at": expiry_check["expiry_date"],
                            "days_overdue": expiry_check["days_overdue"]
                        })
                    elif expiry_check["is_warning"]:
                        warnings.append({
                            "field_id": field_id_str,
                            "field_name": field.name,
                            "field_label": field.label,
                            "message": f"'{field.label}' expires in {expiry_check['days_until_expiry']} days",
                            "expiry_date": expiry_check["expiry_date"],
                            "days_until_expiry": expiry_check["days_until_expiry"]
                        })

        # Determine overall status
        # NEW: No more "pending" status - persons without requirements are "valid"
        if errors:
            status = "expired"
            is_compliant = False
        elif warnings:
            status = "warning"
            is_compliant = True  # Still compliant, but with warnings
        else:
            status = "valid"
            is_compliant = True

        # Update person's compliance status
        person.compliance_status = status
        self.db.commit()

        return {
            "status": status,
            "is_compliant": is_compliant,
            "warnings": warnings,
            "errors": errors,
            "checked_at": datetime.utcnow()
        }

    def _evaluate_compliance_rule(self, field: FieldDefinition, value: Any) -> Dict[str, Any]:
        """
        Evaluate a compliance rule for a field.

        Supported check_types:
        - date_not_expired: Date must be in the future
        - date_before: Date must be before compare_value
        - date_after: Date must be after compare_value
        - checkbox_is_true: Checkbox must be checked
        - checkbox_is_false: Checkbox must be unchecked
        - value_equals: Value must equal compare_value
        - value_not_equals: Value must not equal compare_value
        - number_greater_than: Number must be greater than compare_value
        - number_less_than: Number must be less than compare_value
        - not_empty: Field must have a value

        Returns:
        {"status": "valid"|"warning"|"error", "message": str|None, ...}
        """
        config = field.configuration or {}
        rules = config.get("compliance_rules", {})

        if not rules:
            return {"status": "valid", "message": None}

        check_type = rules.get("check_type")

        if not check_type:
            return {"status": "valid", "message": None}

        # Route to specific check method
        if check_type == "date_not_expired":
            return self._check_date_not_expired(field, value, rules)
        elif check_type == "date_before":
            return self._check_date_before(field, value, rules)
        elif check_type == "date_after":
            return self._check_date_after(field, value, rules)
        elif check_type == "checkbox_is_true":
            return self._check_checkbox_true(field, value, rules)
        elif check_type == "checkbox_is_false":
            return self._check_checkbox_false(field, value, rules)
        elif check_type == "value_equals":
            return self._check_value_equals(field, value, rules)
        elif check_type == "value_not_equals":
            return self._check_value_not_equals(field, value, rules)
        elif check_type == "number_greater_than":
            return self._check_number_greater_than(field, value, rules)
        elif check_type == "number_less_than":
            return self._check_number_less_than(field, value, rules)
        elif check_type == "not_empty":
            return self._check_not_empty(field, value, rules)
        else:
            logger.warning(f"Unknown compliance check_type: {check_type}")
            return {"status": "valid", "message": None}

    def _check_date_not_expired(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a date is not expired (in the future)."""
        if not value:
            return {
                "status": "error",
                "message": rules.get("error_message", f"'{field.label}' is missing")
            }

        try:
            date_val = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if date_val.tzinfo:
                date_val = date_val.replace(tzinfo=None)

            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            warning_days = rules.get("warning_days", 30)
            days_diff = (date_val - today).days

            if days_diff < 0:
                return {
                    "status": "error",
                    "message": rules.get("error_message", f"'{field.label}' has expired"),
                    "days_overdue": abs(days_diff)
                }
            elif days_diff <= warning_days:
                return {
                    "status": "warning",
                    "message": f"'{field.label}' expires in {days_diff} days",
                    "days_until": days_diff
                }
            else:
                return {"status": "valid", "message": None}

        except Exception as e:
            logger.warning(f"Failed to parse date for field {field.name}: {e}")
            return {
                "status": "error",
                "message": f"Invalid date format for '{field.label}'"
            }

    def _check_date_before(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a date is before compare_value."""
        if not value:
            return {"status": "valid", "message": None}

        try:
            date_val = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if date_val.tzinfo:
                date_val = date_val.replace(tzinfo=None)

            compare_to = rules.get("compare_to", "today")

            if compare_to == "today":
                compare_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                compare_value = rules.get("compare_value")
                if not compare_value:
                    return {"status": "valid", "message": None}
                compare_date = datetime.fromisoformat(str(compare_value).replace("Z", "+00:00"))
                if compare_date.tzinfo:
                    compare_date = compare_date.replace(tzinfo=None)

            if date_val >= compare_date:
                return {
                    "status": "error",
                    "message": rules.get("error_message", f"'{field.label}' must be before the specified date")
                }

            return {"status": "valid", "message": None}

        except Exception as e:
            logger.warning(f"Failed to parse date for field {field.name}: {e}")
            return {"status": "error", "message": f"Invalid date format for '{field.label}'"}

    def _check_date_after(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a date is after compare_value."""
        if not value:
            return {"status": "valid", "message": None}

        try:
            date_val = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if date_val.tzinfo:
                date_val = date_val.replace(tzinfo=None)

            compare_to = rules.get("compare_to", "today")

            if compare_to == "today":
                compare_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                compare_value = rules.get("compare_value")
                if not compare_value:
                    return {"status": "valid", "message": None}
                compare_date = datetime.fromisoformat(str(compare_value).replace("Z", "+00:00"))
                if compare_date.tzinfo:
                    compare_date = compare_date.replace(tzinfo=None)

            if date_val <= compare_date:
                return {
                    "status": "error",
                    "message": rules.get("error_message", f"'{field.label}' must be after the specified date")
                }

            return {"status": "valid", "message": None}

        except Exception as e:
            logger.warning(f"Failed to parse date for field {field.name}: {e}")
            return {"status": "error", "message": f"Invalid date format for '{field.label}'"}

    def _check_checkbox_true(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a checkbox is checked (true)."""
        is_checked = value in [True, "true", "True", 1, "1"]

        if not is_checked:
            return {
                "status": "error",
                "message": rules.get("error_message", f"'{field.label}' must be checked")
            }

        return {"status": "valid", "message": None}

    def _check_checkbox_false(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a checkbox is unchecked (false)."""
        is_checked = value in [True, "true", "True", 1, "1"]

        if is_checked:
            return {
                "status": "error",
                "message": rules.get("error_message", f"'{field.label}' must be unchecked")
            }

        return {"status": "valid", "message": None}

    def _check_value_equals(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a value equals the compare_value."""
        compare_value = rules.get("compare_value")

        if compare_value is None:
            return {"status": "valid", "message": None}

        if str(value) != str(compare_value):
            return {
                "status": "error",
                "message": rules.get("error_message", f"'{field.label}' must be '{compare_value}'")
            }

        return {"status": "valid", "message": None}

    def _check_value_not_equals(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a value does not equal the compare_value."""
        compare_value = rules.get("compare_value")

        if compare_value is None:
            return {"status": "valid", "message": None}

        if str(value) == str(compare_value):
            return {
                "status": "error",
                "message": rules.get("error_message", f"'{field.label}' must not be '{compare_value}'")
            }

        return {"status": "valid", "message": None}

    def _check_number_greater_than(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a number is greater than compare_value."""
        compare_value = rules.get("compare_value")

        if compare_value is None:
            return {"status": "valid", "message": None}

        try:
            num_value = float(value)
            num_compare = float(compare_value)

            if num_value <= num_compare:
                return {
                    "status": "error",
                    "message": rules.get("error_message", f"'{field.label}' must be greater than {compare_value}")
                }

            return {"status": "valid", "message": None}

        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to parse number for field {field.name}: {e}")
            return {"status": "error", "message": f"Invalid number format for '{field.label}'"}

    def _check_number_less_than(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a number is less than compare_value."""
        compare_value = rules.get("compare_value")

        if compare_value is None:
            return {"status": "valid", "message": None}

        try:
            num_value = float(value)
            num_compare = float(compare_value)

            if num_value >= num_compare:
                return {
                    "status": "error",
                    "message": rules.get("error_message", f"'{field.label}' must be less than {compare_value}")
                }

            return {"status": "valid", "message": None}

        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to parse number for field {field.name}: {e}")
            return {"status": "error", "message": f"Invalid number format for '{field.label}'"}

    def _check_not_empty(self, field: FieldDefinition, value: Any, rules: Dict) -> Dict[str, Any]:
        """Check that a field has a non-empty value."""
        if value is None or value == "" or (isinstance(value, str) and value.strip() == ""):
            return {
                "status": "error",
                "message": rules.get("error_message", f"'{field.label}' must not be empty")
            }

        return {"status": "valid", "message": None}

    def _check_expiry(self, field: FieldDefinition, value: str) -> Optional[Dict[str, Any]]:
        """
        Check expiry status of a date_expiry field (legacy support).

        Returns:
        {
            "expiry_date": str,
            "is_expired": bool,
            "is_warning": bool,
            "days_until_expiry": int or None,
            "days_overdue": int or None
        }
        """
        try:
            expiry_date = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if expiry_date.tzinfo is None:
                expiry_date = expiry_date.replace(tzinfo=None)

            now = datetime.utcnow()
            config = field.configuration or {}
            warning_days = config.get("warning_days", 30)
            critical_days = config.get("critical_days", 7)

            days_diff = (expiry_date.replace(tzinfo=None) - now).days

            return {
                "expiry_date": expiry_date.isoformat(),
                "is_expired": days_diff < 0,
                "is_warning": 0 <= days_diff <= warning_days,
                "is_critical": 0 <= days_diff <= critical_days,
                "days_until_expiry": days_diff if days_diff >= 0 else None,
                "days_overdue": abs(days_diff) if days_diff < 0 else None
            }

        except Exception as e:
            logger.warning(f"Failed to check expiry for field {field.name}: {e}")
            return None

    def validate_field_data(self, field_data: dict) -> Dict[str, Any]:
        """
        Validate all field data without a person context.

        Returns:
        {
            "valid": bool,
            "errors": {field_id: error_message}
        }
        """
        all_fields = self.field_service.get_all()
        errors = {}

        for field in all_fields:
            # Skip system fields
            if field.is_system:
                continue

            field_id_str = str(field.id)
            value = field_data.get(field_id_str)

            # Skip non-required empty fields
            if (value is None or value == "") and not field.is_required:
                continue

            # Check required
            if field.is_required and (value is None or value == ""):
                errors[field_id_str] = f"Field '{field.label}' is required"
                continue

            # Validate value
            if value is not None and value != "":
                validation_result = self.field_service.validate_value(field, value)
                if not validation_result["valid"]:
                    errors[field_id_str] = validation_result["error"]

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def get_expiring_soon(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get all persons with fields expiring within the given days.

        Returns list of:
        {
            "person": Person,
            "expiring_fields": [{"field": FieldDefinition, "expiry_date": str, "days_until": int}]
        }
        """
        results = []

        # Get fields with date_not_expired compliance rules OR date_expiry type
        all_fields = self.db.query(FieldDefinition).all()
        expiry_fields = []

        for field in all_fields:
            config = field.configuration or {}
            rules = config.get("compliance_rules", {})
            check_type = rules.get("check_type")

            if check_type == "date_not_expired" or field.field_type == "date_expiry":
                expiry_fields.append(field)

        if not expiry_fields:
            return results

        persons = self.db.query(Person)\
            .filter(Person.is_active == True, Person.deleted_at.is_(None))\
            .all()

        cutoff_date = datetime.utcnow() + timedelta(days=days)

        for person in persons:
            expiring = []
            field_data = person.field_data or {}

            for field in expiry_fields:
                value = field_data.get(str(field.id))
                if not value:
                    continue

                try:
                    expiry_date = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                    if expiry_date.tzinfo:
                        expiry_date = expiry_date.replace(tzinfo=None)

                    if expiry_date <= cutoff_date:
                        days_until = (expiry_date - datetime.utcnow()).days
                        expiring.append({
                            "field": field,
                            "expiry_date": expiry_date.isoformat(),
                            "days_until": days_until
                        })
                except:
                    continue

            if expiring:
                results.append({
                    "person": person,
                    "expiring_fields": expiring
                })

        return results
