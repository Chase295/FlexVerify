"""
Audit Service
=============
Handles audit logging for all system changes.
"""

from sqlalchemy.orm import Session
from typing import Optional, Any
from uuid import UUID
import logging

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


class AuditService:
    """Service for audit logging"""

    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        user: Optional[User],
        action: str,
        resource_type: str,
        resource_id: Optional[UUID] = None,
        old_value: Optional[dict] = None,
        new_value: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        auto_commit: bool = True
    ) -> AuditLog:
        """Create an audit log entry

        Args:
            auto_commit: If False, the caller is responsible for committing.
                        Use this when batching with other DB operations.
        """
        try:
            log_entry = AuditLog(
                user_id=user.id if user else None,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                old_value=old_value,
                new_value=new_value,
                ip_address=ip_address,
                user_agent=user_agent
            )
            self.db.add(log_entry)

            if auto_commit:
                self.db.commit()

            logger.debug(f"Audit log created: {action} on {resource_type}")
            return log_entry

        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            self.db.rollback()
            raise

    def log_create(
        self,
        user: User,
        resource_type: str,
        resource_id: UUID,
        new_value: dict,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Log a create action"""
        return self.log(
            user=user,
            action="create",
            resource_type=resource_type,
            resource_id=resource_id,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent
        )

    def log_update(
        self,
        user: User,
        resource_type: str,
        resource_id: UUID,
        old_value: dict,
        new_value: dict,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Log an update action"""
        return self.log(
            user=user,
            action="update",
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent
        )

    def log_delete(
        self,
        user: User,
        resource_type: str,
        resource_id: UUID,
        old_value: dict,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Log a delete action"""
        return self.log(
            user=user,
            action="delete",
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            ip_address=ip_address,
            user_agent=user_agent
        )

    def log_view(
        self,
        user: User,
        resource_type: str,
        resource_id: UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Log a view action"""
        return self.log(
            user=user,
            action="view",
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent
        )

    def log_login(
        self,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Log a login action"""
        return self.log(
            user=user,
            action="login",
            resource_type="user",
            resource_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent
        )

    def log_logout(
        self,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Log a logout action"""
        return self.log(
            user=user,
            action="logout",
            resource_type="user",
            resource_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent
        )

    def log_scan(
        self,
        user: Optional[User],
        person_id: Optional[UUID],
        method: str,
        result: str,
        confidence: Optional[float] = None,
        person_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        auto_commit: bool = True
    ) -> AuditLog:
        """Log a scan/recognition event"""
        return self.log(
            user=user,
            action="scan",
            resource_type="person",
            resource_id=person_id,
            new_value={
                "method": method,
                "result": result,
                "confidence": confidence,
                "person_name": person_name
            },
            ip_address=ip_address,
            user_agent=user_agent,
            auto_commit=auto_commit
        )
