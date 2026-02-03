"""
Recognition Routes
==================
Face, QR, Barcode, and Text search endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import Optional
import logging
import json
import os

from app.config.database import get_db
from app.config.settings import settings
from app.models.user import User
from app.models.scan_event import ScanEvent
from app.models.field_definition import FieldDefinition
from app.services.person_service import PersonService
from app.services.audit_service import AuditService
from app.middleware.auth import PermissionChecker, get_current_user, get_current_active_user
from app.schemas.recognition import (
    FaceSearchResponse, PersonMatchResponse, ComplianceCheckResponse,
    QRLookupRequest, QRLookupResponse,
    BarcodeLookupRequest, BarcodeLookupResponse,
    TextSearchRequest, TextSearchResponse,
    RecognitionSettingsResponse, RecognitionSettingsUpdate
)
from app.schemas.person import PersonResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Settings file for persistence
SETTINGS_FILE = "recognition_settings.json"


def get_result_display_config(user: User) -> dict:
    """Get the merged result_display config for a user from their roles."""
    default_display = {
        "show_photo": True,
        "show_compliance_status": True,
        "visible_fields": ["first_name", "last_name", "email", "phone", "personnel_number"]
    }

    # Superadmin sees everything
    if user.is_superadmin:
        return default_display

    if not user.roles:
        return default_display

    # Collect result_display configs from all roles
    merged = {
        "show_photo": False,
        "show_compliance_status": False,
        "visible_fields": []
    }

    has_config = False
    for role in user.roles:
        if role.scanner_config and role.scanner_config.get("result_display"):
            has_config = True
            rd = role.scanner_config["result_display"]
            if rd.get("show_photo"):
                merged["show_photo"] = True
            if rd.get("show_compliance_status"):
                merged["show_compliance_status"] = True
            for field in rd.get("visible_fields", []):
                if field not in merged["visible_fields"]:
                    merged["visible_fields"].append(field)

    # If no config found, use defaults
    if not has_config:
        return default_display

    # If visible_fields is empty, use defaults
    if not merged["visible_fields"]:
        merged["visible_fields"] = ["first_name", "last_name", "personnel_number"]

    return merged


def get_field_labels(db) -> dict:
    """Get dynamic field labels from database (cached per request)."""
    field_defs = db.query(FieldDefinition).all()
    return {str(f.id): f.label for f in field_defs}


def filter_person_response(person, display_config: dict, db, field_labels: dict = None) -> PersonMatchResponse:
    """Filter person data based on result_display configuration.

    Args:
        field_labels: Pre-fetched field labels dict to avoid N+1 queries.
                     If None, will query the database.
    """
    visible = display_config.get("visible_fields", [])

    # Standard field labels
    standard_labels = {
        "first_name": "Vorname",
        "last_name": "Nachname",
        "email": "E-Mail",
        "phone": "Telefon",
        "personnel_number": "Personalnummer"
    }

    # Filter standard fields
    first_name = person.first_name if "first_name" in visible else None
    last_name = person.last_name if "last_name" in visible else None
    email = person.email if "email" in visible else None
    phone = person.phone if "phone" in visible else None
    personnel_number = person.personnel_number if "personnel_number" in visible else None

    # Build full_name based on visible fields
    if first_name and last_name:
        full_name = f"{first_name} {last_name}"
    elif first_name:
        full_name = first_name
    elif last_name:
        full_name = last_name
    else:
        full_name = "***"

    # Use provided field_labels or fetch from db
    dynamic_labels = field_labels if field_labels is not None else get_field_labels(db)

    # Filter dynamic field_data
    filtered_field_data = {}
    if person.field_data:
        for field_id, value in person.field_data.items():
            if field_id in visible:
                filtered_field_data[field_id] = value

    # Build visible_field_labels - only for fields that are visible AND have values
    visible_field_labels = {}
    for field_id in visible:
        if field_id in standard_labels:
            # Check if standard field has a value
            field_value = None
            if field_id == "first_name":
                field_value = first_name
            elif field_id == "last_name":
                field_value = last_name
            elif field_id == "email":
                field_value = email
            elif field_id == "phone":
                field_value = phone
            elif field_id == "personnel_number":
                field_value = personnel_number
            if field_value:
                visible_field_labels[field_id] = standard_labels[field_id]
        elif field_id in dynamic_labels:
            # Check if dynamic field has a value
            if person.field_data and field_id in person.field_data and person.field_data[field_id]:
                visible_field_labels[field_id] = dynamic_labels[field_id]

    # Photo URL only if show_photo is enabled
    photo_url = None
    if display_config.get("show_photo") and person.profile_photo_path:
        photo_url = f"/api/persons/{person.id}/photo"

    return PersonMatchResponse(
        id=person.id,
        first_name=first_name,
        last_name=last_name,
        full_name=full_name,
        email=email,
        phone=phone,
        personnel_number=personnel_number,
        photo_url=photo_url,
        field_data=filtered_field_data,
        visible_field_labels=visible_field_labels
    )


def get_face_threshold() -> float:
    """Get current face recognition threshold"""
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
                return data.get("face_threshold", settings.FACE_RECOGNITION_THRESHOLD)
    except:
        pass
    return settings.FACE_RECOGNITION_THRESHOLD


def set_face_threshold(threshold: float):
    """Set face recognition threshold"""
    try:
        data = {}
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
        data["face_threshold"] = threshold
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        logger.error(f"Failed to save threshold: {e}")


@router.post("/face-search", response_model=FaceSearchResponse)
async def face_search(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recognition.face"))
):
    """
    Search for a person by face recognition.

    Upload a photo and the system will:
    1. Extract face vectors (primary, normalized, grayscale)
    2. Compare against all stored face vectors
    3. Return the best match above threshold with compliance status
    """
    logger.info("Face search request received")

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # Read image data
    photo_data = await file.read()

    if len(photo_data) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file too large (max 50MB)"
        )

    # Perform face search
    person_service = PersonService(db)
    threshold = get_face_threshold()

    result = person_service.face_search(photo_data, threshold=threshold)

    # Log scan event and audit trail in single commit
    scan_event = ScanEvent(
        person_id=result["person"].id if result["match"] else None,
        scanned_by=current_user.id,
        search_method="face",
        confidence=result["confidence"] / 100 if result["confidence"] else None,
        result="allowed" if result["match"] and result.get("compliance", {}).get("is_compliant", True) else "denied" if result["match"] else "no_match",
        denial_reasons=result.get("compliance", {}).get("errors", []) if result["match"] else [],
        device_info={"user_agent": request.headers.get("user-agent")},
        location={}
    )
    db.add(scan_event)

    # Log to audit trail (no auto-commit, we'll commit both together)
    audit = AuditService(db)
    person_name = None
    if result["match"] and result["person"]:
        p = result["person"]
        person_name = f"{p.first_name} {p.last_name}".strip() if p.first_name or p.last_name else None

    audit.log_scan(
        user=current_user,
        person_id=result["person"].id if result["match"] else None,
        method="face",
        result=scan_event.result,
        confidence=result.get("confidence"),
        person_name=person_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        auto_commit=False
    )

    # Single commit for both scan event and audit log
    db.commit()

    # Build response
    if result["match"]:
        person = result["person"]
        compliance = result.get("compliance", {})

        # Get result display config for current user
        display_config = get_result_display_config(current_user)

        # Pre-fetch field labels once
        field_labels = get_field_labels(db)

        # Filter person data based on config
        filtered_person = filter_person_response(person, display_config, db, field_labels)

        # Only include compliance status if configured
        compliance_response = None
        if display_config.get("show_compliance_status"):
            compliance_response = ComplianceCheckResponse(
                status=compliance.get("status", "pending"),
                is_compliant=compliance.get("is_compliant", True),
                warnings=compliance.get("warnings", []),
                errors=compliance.get("errors", [])
            )

        return FaceSearchResponse(
            match=True,
            person=filtered_person,
            confidence=result["confidence"],
            best_distance=result["best_distance"],
            vector_types_tested=result["vector_types_tested"],
            compliance_status=compliance_response
        )
    else:
        return FaceSearchResponse(
            match=False,
            confidence=result.get("confidence"),
            best_distance=result.get("best_distance"),
            vector_types_tested=result["vector_types_tested"],
            reason=result.get("reason", "No match found")
        )


@router.post("/qr-lookup", response_model=QRLookupResponse)
async def qr_lookup(
    request: Request,
    data: QRLookupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recognition.qr"))
):
    """Look up a person by QR code"""
    person_service = PersonService(db)
    person = person_service.get_by_qr_code(data.qr_code)

    # Log scan event
    scan_event = ScanEvent(
        person_id=person.id if person else None,
        scanned_by=current_user.id,
        search_method="qr",
        confidence=1.0 if person else None,
        result="allowed" if person else "no_match",
        device_info={"user_agent": request.headers.get("user-agent")}
    )
    db.add(scan_event)
    db.commit()

    if not person:
        return QRLookupResponse(
            found=False,
            reason="No person found with this QR code"
        )

    # Validate compliance
    from app.services.validation_service import ValidationService
    validation_service = ValidationService(db)
    compliance = validation_service.validate_person(person)

    return QRLookupResponse(
        found=True,
        person=PersonMatchResponse(
            id=person.id,
            first_name=person.first_name,
            last_name=person.last_name,
            full_name=person.full_name,
            email=person.email,
            phone=person.phone,
            personnel_number=person.personnel_number,
            photo_url=f"/api/persons/{person.id}/photo" if person.profile_photo_path else None,
            field_data=person.field_data or {}
        ),
        compliance_status=ComplianceCheckResponse(
            status=compliance.get("status", "pending"),
            is_compliant=compliance.get("is_compliant", True),
            warnings=compliance.get("warnings", []),
            errors=compliance.get("errors", [])
        )
    )


@router.post("/barcode-lookup", response_model=BarcodeLookupResponse)
async def barcode_lookup(
    request: Request,
    data: BarcodeLookupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recognition.barcode"))
):
    """Look up a person by barcode"""
    person_service = PersonService(db)
    person = person_service.get_by_barcode(data.barcode)

    # Log scan event
    scan_event = ScanEvent(
        person_id=person.id if person else None,
        scanned_by=current_user.id,
        search_method="barcode",
        confidence=1.0 if person else None,
        result="allowed" if person else "no_match",
        device_info={"user_agent": request.headers.get("user-agent")}
    )
    db.add(scan_event)
    db.commit()

    if not person:
        return BarcodeLookupResponse(
            found=False,
            reason="No person found with this barcode"
        )

    # Validate compliance
    from app.services.validation_service import ValidationService
    validation_service = ValidationService(db)
    compliance = validation_service.validate_person(person)

    return BarcodeLookupResponse(
        found=True,
        person=PersonMatchResponse(
            id=person.id,
            first_name=person.first_name,
            last_name=person.last_name,
            full_name=person.full_name,
            email=person.email,
            phone=person.phone,
            personnel_number=person.personnel_number,
            photo_url=f"/api/persons/{person.id}/photo" if person.profile_photo_path else None,
            field_data=person.field_data or {}
        ),
        compliance_status=ComplianceCheckResponse(
            status=compliance.get("status", "pending"),
            is_compliant=compliance.get("is_compliant", True),
            warnings=compliance.get("warnings", []),
            errors=compliance.get("errors", [])
        )
    )


@router.post("/text-search", response_model=TextSearchResponse)
async def text_search(
    request: Request,
    data: TextSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recognition.text"))
):
    """Search for persons by text query"""
    person_service = PersonService(db)
    persons = person_service.search_by_text(
        query=data.query,
        fields=data.fields,
        limit=data.limit
    )

    # Get result display config for current user
    display_config = get_result_display_config(current_user)

    # Pre-fetch field labels once (avoid N+1 query)
    field_labels = get_field_labels(db)

    # Filter person data based on config
    results = [
        filter_person_response(p, display_config, db, field_labels)
        for p in persons
    ]

    # Log to audit trail
    audit = AuditService(db)
    first_person_name = None
    if persons:
        p = persons[0]
        first_person_name = f"{p.first_name} {p.last_name}".strip() if p.first_name or p.last_name else None

    audit.log_scan(
        user=current_user,
        person_id=results[0].id if results else None,
        method="text",
        result="match" if results else "no_match",
        confidence=None,
        person_name=first_person_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    return TextSearchResponse(
        results=results,
        total=len(results),
        query=data.query
    )


@router.get("/my-scanner-config")
async def get_my_scanner_config(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get merged scanner configuration for current user from all roles.
    This determines which scanner modes and options are available to the user.
    """
    # Default config for superadmin or when no config is set
    # DISABLED: QR/Barcode modes temporarily disabled
    default_config = {
        "enabled_modes": ["face", "text"],
        "default_mode": "face",
        "text_search": {
            "enabled_fields": ["first_name", "last_name", "email", "phone", "personnel_number"],
            "default_fields": ["last_name", "personnel_number"],
            "max_results": 50
        },
        "face_recognition": {
            "show_confidence": True,
            "min_confidence": 0
        },
        "result_display": {
            "show_photo": True,
            "show_compliance_status": True,
            "visible_fields": ["first_name", "last_name", "email", "phone", "personnel_number"]
        }
    }

    # Superadmin gets everything
    if current_user.is_superadmin:
        return default_config

    # Merge configs from all user roles
    if not current_user.roles:
        return default_config

    # Collect all scanner configs from roles
    configs = [role.scanner_config for role in current_user.roles if role.scanner_config]

    if not configs:
        # No scanner configs defined, use permissions to determine modes
        enabled_modes = []
        perms = {}
        for role in current_user.roles:
            if role.permissions:
                perms.update(role.permissions)

        if perms.get("recognition.face"):
            enabled_modes.append("face")
        # DISABLED: QR/Barcode modes temporarily disabled
        # if perms.get("recognition.qr"):
        #     enabled_modes.append("qr")
        # if perms.get("recognition.barcode"):
        #     enabled_modes.append("barcode")
        if perms.get("recognition.text"):
            enabled_modes.append("text")

        if not enabled_modes:
            # DISABLED: QR/Barcode modes temporarily disabled
            enabled_modes = ["face", "text"]

        return {
            **default_config,
            "enabled_modes": enabled_modes,
            "default_mode": enabled_modes[0] if enabled_modes else "face"
        }

    # Merge multiple configs (union of modes and fields)
    merged = {
        "enabled_modes": [],
        "default_mode": None,
        "text_search": {
            "enabled_fields": [],
            "default_fields": [],
            "max_results": 10
        },
        "face_recognition": {
            "show_confidence": True,
            "min_confidence": 100
        },
        "result_display": {
            "show_photo": False,
            "show_compliance_status": False,
            "visible_fields": []
        }
    }

    for config in configs:
        # Union of enabled modes
        for mode in config.get("enabled_modes", []):
            if mode not in merged["enabled_modes"]:
                merged["enabled_modes"].append(mode)

        # First defined default_mode wins
        if not merged["default_mode"] and config.get("default_mode"):
            merged["default_mode"] = config["default_mode"]

        # Text search: union of fields, max of max_results
        ts = config.get("text_search", {})
        for field in ts.get("enabled_fields", []):
            if field not in merged["text_search"]["enabled_fields"]:
                merged["text_search"]["enabled_fields"].append(field)
        for field in ts.get("default_fields", []):
            if field not in merged["text_search"]["default_fields"]:
                merged["text_search"]["default_fields"].append(field)
        merged["text_search"]["max_results"] = max(
            merged["text_search"]["max_results"],
            ts.get("max_results", 10)
        )

        # Face recognition: show_confidence if any config shows it, min of min_confidence
        fr = config.get("face_recognition", {})
        if fr.get("show_confidence"):
            merged["face_recognition"]["show_confidence"] = True
        merged["face_recognition"]["min_confidence"] = min(
            merged["face_recognition"]["min_confidence"],
            fr.get("min_confidence", 70)
        )

        # Result display: union of visible_fields, OR of show_photo/show_compliance_status
        rd = config.get("result_display", {})
        if rd.get("show_photo"):
            merged["result_display"]["show_photo"] = True
        if rd.get("show_compliance_status"):
            merged["result_display"]["show_compliance_status"] = True
        for field in rd.get("visible_fields", []):
            if field not in merged["result_display"]["visible_fields"]:
                merged["result_display"]["visible_fields"].append(field)

    # Set defaults if empty
    # DISABLED: QR/Barcode modes temporarily disabled
    if not merged["enabled_modes"]:
        merged["enabled_modes"] = ["face", "text"]
    if not merged["default_mode"]:
        merged["default_mode"] = merged["enabled_modes"][0]
    if not merged["text_search"]["enabled_fields"]:
        merged["text_search"]["enabled_fields"] = ["last_name", "personnel_number", "email"]
    if not merged["text_search"]["default_fields"]:
        merged["text_search"]["default_fields"] = ["last_name"]

    # Result display defaults
    if not merged["result_display"]["visible_fields"]:
        merged["result_display"]["visible_fields"] = ["first_name", "last_name", "personnel_number"]
    if not merged["result_display"]["show_photo"] and not merged["result_display"]["show_compliance_status"]:
        # If nothing is set, show defaults
        merged["result_display"]["show_photo"] = True
        merged["result_display"]["show_compliance_status"] = True

    return merged


@router.get("/settings", response_model=RecognitionSettingsResponse)
async def get_settings(
    current_user: User = Depends(PermissionChecker("settings.read"))
):
    """Get recognition settings"""
    threshold = get_face_threshold()

    return RecognitionSettingsResponse(
        face_threshold=threshold,
        face_threshold_percent=round(threshold * 100, 1),
        model=settings.FACE_RECOGNITION_MODEL,
        description=f"Matches require at least {round(threshold * 100, 1)}% confidence"
    )


@router.put("/settings", response_model=RecognitionSettingsResponse)
async def update_settings(
    data: RecognitionSettingsUpdate,
    current_user: User = Depends(PermissionChecker("settings.update"))
):
    """Update recognition settings"""
    threshold = data.face_threshold_percent / 100.0
    threshold = max(0.0, min(1.0, threshold))  # Clamp to 0-1

    set_face_threshold(threshold)

    logger.info(f"Face threshold updated to {threshold * 100}% by {current_user.email}")

    return RecognitionSettingsResponse(
        face_threshold=threshold,
        face_threshold_percent=round(threshold * 100, 1),
        model=settings.FACE_RECOGNITION_MODEL,
        description=f"Matches require at least {round(threshold * 100, 1)}% confidence"
    )
