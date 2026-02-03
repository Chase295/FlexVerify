"""
Person Service
==============
Handles person management including face recognition integration.
"""

from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
import os
import hashlib
import logging
from datetime import datetime

from app.models.person import Person
from app.models.user import User
from app.services.face_service import FaceService
from app.services.field_service import FieldService
from app.services.validation_service import ValidationService
from app.config.settings import settings

logger = logging.getLogger(__name__)


class PersonService:
    """Service for person management"""

    def __init__(self, db: Session):
        self.db = db
        self.face_service = FaceService()
        self.field_service = FieldService(db)
        self.validation_service = ValidationService(db)

    def get_all(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        compliance_status: Optional[str] = None
    ) -> Tuple[List[Person], int]:
        """
        Get all persons with filtering and pagination.
        Returns (persons, total_count)
        """
        query = self.db.query(Person).filter(Person.deleted_at.is_(None))

        # Apply filters
        if is_active is not None:
            query = query.filter(Person.is_active == is_active)

        if compliance_status:
            query = query.filter(Person.compliance_status == compliance_status)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Person.first_name.ilike(search_term),
                    Person.last_name.ilike(search_term),
                    Person.email.ilike(search_term),
                    Person.personnel_number.ilike(search_term),
                    Person.qr_code.ilike(search_term),
                    Person.barcode.ilike(search_term)
                )
            )

        # Get total count
        total = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        persons = query.order_by(Person.last_name, Person.first_name)\
            .offset(offset)\
            .limit(page_size)\
            .all()

        return persons, total

    def get_by_id(self, person_id: UUID) -> Optional[Person]:
        """Get a person by ID"""
        return self.db.query(Person)\
            .filter(Person.id == person_id, Person.deleted_at.is_(None))\
            .first()

    def get_by_qr_code(self, qr_code: str) -> Optional[Person]:
        """Get a person by QR code"""
        return self.db.query(Person)\
            .filter(Person.qr_code == qr_code, Person.deleted_at.is_(None))\
            .first()

    def get_by_barcode(self, barcode: str) -> Optional[Person]:
        """Get a person by barcode"""
        return self.db.query(Person)\
            .filter(Person.barcode == barcode, Person.deleted_at.is_(None))\
            .first()

    def search_by_text(self, query: str, fields: List[str] = None, limit: int = 10) -> List[Person]:
        """
        Search persons by text query.
        Uses ILIKE for fuzzy matching on specified fields.
        """
        if not fields:
            fields = ["first_name", "last_name", "personnel_number", "email"]

        search_term = f"%{query}%"
        conditions = []

        field_map = {
            "first_name": Person.first_name,
            "last_name": Person.last_name,
            "email": Person.email,
            "phone": Person.phone,
            "personnel_number": Person.personnel_number,
            "qr_code": Person.qr_code,
            "barcode": Person.barcode
        }

        for field in fields:
            if field in field_map:
                conditions.append(field_map[field].ilike(search_term))

        if not conditions:
            return []

        return self.db.query(Person)\
            .filter(Person.deleted_at.is_(None), Person.is_active == True)\
            .filter(or_(*conditions))\
            .limit(limit)\
            .all()

    def get_active_with_vectors(self) -> List[Person]:
        """Get all active persons with face vectors for recognition"""
        return self.db.query(Person)\
            .filter(
                Person.is_active == True,
                Person.deleted_at.is_(None),
                or_(
                    Person.face_vector_primary.isnot(None),
                    Person.face_vector_normalized.isnot(None),
                    Person.face_vector_grayscale.isnot(None)
                )
            )\
            .all()

    def create(self, data: dict, created_by: Optional[User] = None) -> Person:
        """Create a new person"""
        # Validate field data if provided
        if data.get("field_data"):
            validation = self.validation_service.validate_field_data(data["field_data"])
            if not validation["valid"]:
                raise ValueError(f"Field validation failed: {validation['errors']}")

        person = Person(
            first_name=data["first_name"],
            last_name=data["last_name"],
            email=data.get("email"),
            phone=data.get("phone"),
            personnel_number=data.get("personnel_number"),
            qr_code=data.get("qr_code"),
            barcode=data.get("barcode"),
            field_data=data.get("field_data", {}),
            created_by=created_by.id if created_by else None
        )

        self.db.add(person)
        self.db.commit()
        self.db.refresh(person)

        # Validate compliance
        self.validation_service.validate_person(person)

        return person

    def update(self, person_id: UUID, data: dict) -> Optional[Person]:
        """Update a person"""
        person = self.get_by_id(person_id)
        if not person:
            return None

        # Validate field data if provided
        if data.get("field_data"):
            # Merge with existing field data
            merged_data = {**(person.field_data or {}), **data["field_data"]}
            validation = self.validation_service.validate_field_data(merged_data)
            if not validation["valid"]:
                raise ValueError(f"Field validation failed: {validation['errors']}")
            data["field_data"] = merged_data

        # Update fields
        for key, value in data.items():
            if hasattr(person, key) and value is not None:
                setattr(person, key, value)

        self.db.commit()
        self.db.refresh(person)

        # Re-validate compliance
        self.validation_service.validate_person(person)

        return person

    def delete(self, person_id: UUID) -> bool:
        """Soft delete a person"""
        person = self.get_by_id(person_id)
        if not person:
            return False

        person.deleted_at = datetime.utcnow()
        person.is_active = False
        self.db.commit()
        return True

    def update_photo(self, person_id: UUID, photo_data: bytes) -> Optional[Person]:
        """
        Update a person's photo and extract face vectors.

        1. Save photo to disk
        2. Extract multi-vectors using FaceService
        3. Update person record
        """
        person = self.get_by_id(person_id)
        if not person:
            return None

        # Calculate image hash
        image_hash = hashlib.sha256(photo_data).hexdigest()

        # Save photo to disk
        upload_dir = os.path.join(settings.UPLOAD_DIR, "photos")
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"{person.id}_{image_hash[:8]}.jpg"
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, "wb") as f:
            f.write(photo_data)

        # Extract face vectors
        vectors = self.face_service.extract_multiple_face_vectors(photo_data)

        if not vectors:
            logger.warning(f"No face detected in photo for person {person_id}")
            # Still save the photo path even if no face detected
            person.profile_photo_path = filepath
            self.db.commit()
            return person

        # Update person with vectors
        person.profile_photo_path = filepath
        person.face_vector_primary = vectors.get("primary")
        person.face_vector_normalized = vectors.get("normalized")
        person.face_vector_grayscale = vectors.get("grayscale")

        self.db.commit()
        self.db.refresh(person)

        logger.info(f"Updated photo and vectors for person {person_id}: {list(vectors.keys())}")
        return person

    def face_search(self, photo_data: bytes, threshold: float = None) -> Dict[str, Any]:
        """
        Search for a person by face recognition.

        Returns:
        {
            "match": bool,
            "person": Person or None,
            "confidence": float,
            "best_distance": float,
            "vector_types_tested": int,
            "compliance": compliance_result or None,
            "reason": str if no match
        }
        """
        if threshold is None:
            threshold = settings.FACE_RECOGNITION_THRESHOLD

        # Extract live vectors from uploaded photo
        live_vectors = self.face_service.extract_multiple_face_vectors(photo_data)

        if not live_vectors:
            return {
                "match": False,
                "person": None,
                "confidence": None,
                "best_distance": None,
                "vector_types_tested": 0,
                "compliance": None,
                "reason": "No face detected in image"
            }

        # Get all candidates with vectors
        candidates = self.get_active_with_vectors()

        best_match = None
        best_confidence = 0
        best_distance = float('inf')
        total_comparisons = 0

        # Compare against all candidates
        for candidate in candidates:
            candidate_vectors = candidate.get_all_face_vectors()

            if not candidate_vectors:
                continue

            # Test all vector pairs
            for live_type, live_vector in live_vectors.items():
                for stored_type, stored_vector in candidate_vectors.items():
                    try:
                        distance = self.face_service.compare_faces(live_vector, stored_vector)
                        total_comparisons += 1

                        confidence = self.face_service.calculate_confidence(distance)

                        if confidence > best_confidence:
                            best_match = candidate
                            best_confidence = confidence
                            best_distance = distance

                    except Exception as e:
                        logger.warning(f"Vector comparison failed: {e}")
                        continue

        # Check threshold
        threshold_percent = threshold * 100
        if best_match and best_confidence >= threshold_percent:
            # Validate compliance
            compliance = self.validation_service.validate_person(best_match)

            return {
                "match": True,
                "person": best_match,
                "confidence": best_confidence,
                "best_distance": round(best_distance, 3),
                "vector_types_tested": total_comparisons,
                "compliance": compliance
            }
        else:
            return {
                "match": False,
                "person": None,
                "confidence": best_confidence if best_confidence > 0 else None,
                "best_distance": round(best_distance, 3) if best_distance != float('inf') else None,
                "vector_types_tested": total_comparisons,
                "compliance": None,
                "reason": f"No matching person found (best confidence: {best_confidence:.1f}%)"
            }
