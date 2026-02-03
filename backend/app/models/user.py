from sqlalchemy import Column, String, Boolean, TIMESTAMP, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from typing import Optional, Set

from app.config.database import Base


class User(Base):
    """User model for administrators and scanner personnel"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50))

    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False)

    # User-specific field permissions (None = inherit from roles)
    visible_fields = Column(JSONB, nullable=True, default=None)
    editable_fields = Column(JSONB, nullable=True, default=None)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    roles = relationship("Role", secondary="user_roles", back_populates="users")

    def __repr__(self):
        return f"<User {self.email}>"

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission"""
        if self.is_superadmin:
            return True

        for role in self.roles:
            if role.permissions and permission in role.permissions:
                if role.permissions[permission]:
                    return True
        return False

    def get_visible_fields(self) -> Optional[Set[str]]:
        """Get all field IDs visible to this user"""
        if self.is_superadmin:
            return None  # None means all fields visible

        # User-specific fields take precedence
        if self.visible_fields is not None:
            return set(self.visible_fields)

        # Fallback: aggregate from roles
        visible = set()
        for role in self.roles:
            if role.visible_fields:
                visible.update(role.visible_fields)
        return visible if visible else None

    def get_editable_fields(self) -> Optional[Set[str]]:
        """Get all field IDs editable by this user"""
        if self.is_superadmin:
            return None  # None means all fields editable

        # User-specific fields take precedence
        if self.editable_fields is not None:
            return set(self.editable_fields)

        # Fallback: aggregate from roles
        editable = set()
        for role in self.roles:
            if role.editable_fields:
                editable.update(role.editable_fields)
        return editable if editable else None
