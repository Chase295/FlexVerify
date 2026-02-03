from sqlalchemy import Column, String, Boolean, TIMESTAMP, Text, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import uuid

from app.config.database import Base


class Person(Base):
    """Person model - the core entity being tracked for compliance"""
    __tablename__ = "persons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core fields (always present)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    email = Column(String(255), index=True)
    phone = Column(String(50))

    # Dynamic fields stored as JSONB
    # Format: {"field_uuid": value, ...}
    # Values can be: string, number, boolean, array (for multi-select), ISO date string
    field_data = Column(JSONB, default={})

    # Face Recognition vectors (128-dimensional, from dlib/face_recognition)
    profile_photo_path = Column(String(500))
    face_vector_primary = Column(Vector(128))      # Original vector
    face_vector_normalized = Column(Vector(128))   # Gently normalized
    face_vector_grayscale = Column(Vector(128))    # Grayscale version

    # Alternative identifiers
    qr_code = Column(String(255), unique=True, index=True)
    barcode = Column(String(255), unique=True, index=True)
    personnel_number = Column(String(100), index=True)

    # Status
    is_active = Column(Boolean, default=True)
    compliance_status = Column(String(50), default="pending")  # pending, valid, warning, expired

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP)  # Soft delete

    # Relationships
    documents = relationship("Document", back_populates="person", cascade="all, delete-orphan")
    scan_events = relationship("ScanEvent", back_populates="person")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Person {self.first_name} {self.last_name}>"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def get_field_value(self, field_id: str):
        """Get value for a specific field"""
        if self.field_data:
            return self.field_data.get(str(field_id))
        return None

    def set_field_value(self, field_id: str, value):
        """Set value for a specific field"""
        if self.field_data is None:
            self.field_data = {}
        self.field_data[str(field_id)] = value

    def has_face_vectors(self) -> bool:
        """Check if person has face recognition vectors"""
        return (
            self.face_vector_primary is not None or
            self.face_vector_normalized is not None or
            self.face_vector_grayscale is not None
        )

    def get_all_face_vectors(self) -> dict:
        """Get all available face vectors"""
        vectors = {}
        if self.face_vector_primary is not None:
            vectors["primary"] = self.face_vector_primary
        if self.face_vector_normalized is not None:
            vectors["normalized"] = self.face_vector_normalized
        if self.face_vector_grayscale is not None:
            vectors["grayscale"] = self.face_vector_grayscale
        return vectors
