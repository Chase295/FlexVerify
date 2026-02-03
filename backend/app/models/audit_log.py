from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.config.database import Base


class AuditLog(Base):
    """Audit log model for tracking all changes"""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Who
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # What
    action = Column(String(50), nullable=False)  # create, update, delete, view, login, logout, scan
    resource_type = Column(String(50), nullable=False)  # person, field, user, role, document, settings
    resource_id = Column(UUID(as_uuid=True))

    # Changes
    old_value = Column(JSONB)
    new_value = Column(JSONB)

    # Context
    ip_address = Column(INET)
    user_agent = Column(Text)

    # Timestamp
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    user = relationship("User")

    # Indexes for efficient querying
    __table_args__ = (
        Index("ix_audit_logs_created_at", created_at.desc()),
        Index("ix_audit_logs_user_id", user_id),
        Index("ix_audit_logs_resource", resource_type, resource_id),
    )

    def __repr__(self):
        return f"<AuditLog {self.action} {self.resource_type}>"
