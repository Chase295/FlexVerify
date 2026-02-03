from sqlalchemy import Column, String, Float, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.config.database import Base


class ScanEvent(Base):
    """Scan event model for tracking recognition attempts"""
    __tablename__ = "scan_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # References
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"))
    scanned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Scan details
    search_method = Column(String(50), nullable=False)  # face, qr, barcode, text
    confidence = Column(Float)  # For face recognition: 0.0 - 1.0

    # Result
    result = Column(String(50), nullable=False)  # allowed, denied, warning, no_match
    denial_reasons = Column(JSONB, default=[])  # Array of reasons if denied

    # Device/Location info
    device_info = Column(JSONB, default={})  # Browser, OS, device type
    location = Column(JSONB, default={})  # GPS coordinates if available

    # Timestamp
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    person = relationship("Person", back_populates="scan_events")
    scanner = relationship("User", foreign_keys=[scanned_by])

    def __repr__(self):
        return f"<ScanEvent {self.search_method} -> {self.result}>"
