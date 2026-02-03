"""
Audit Log Routes
================
View and export audit logs.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta, timezone
import csv
import io
import logging
import zoneinfo

from app.config.database import get_db
from app.config.settings import settings
from app.models.user import User
from app.models.audit_log import AuditLog
from app.middleware.auth import PermissionChecker


def to_local_time(dt: datetime) -> datetime:
    """Convert UTC datetime to local timezone"""
    if dt is None:
        return None
    try:
        tz = zoneinfo.ZoneInfo(settings.TIMEZONE)
        # Assume dt is UTC if no timezone info
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(tz)
    except Exception:
        return dt

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user_id: Optional[UUID] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("audit.read"))
):
    """List audit logs with filtering and pagination"""
    # Use joinedload to avoid N+1 queries
    query = db.query(AuditLog).options(joinedload(AuditLog.user))

    # Apply filters
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    # Get total count (without joinedload for performance)
    count_query = db.query(func.count(AuditLog.id))
    if user_id:
        count_query = count_query.filter(AuditLog.user_id == user_id)
    if action:
        count_query = count_query.filter(AuditLog.action == action)
    if resource_type:
        count_query = count_query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        count_query = count_query.filter(AuditLog.resource_id == resource_id)
    if from_date:
        count_query = count_query.filter(AuditLog.created_at >= from_date)
    if to_date:
        count_query = count_query.filter(AuditLog.created_at <= to_date)
    total = count_query.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    logs = query.order_by(desc(AuditLog.created_at))\
        .offset(offset)\
        .limit(page_size)\
        .all()

    return {
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_email": log.user.email if log.user else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "ip_address": str(log.ip_address) if log.ip_address else None,
                "created_at": to_local_time(log.created_at).isoformat()
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/actions")
async def get_action_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("audit.read"))
):
    """Get list of distinct action types from actual data"""
    # Query actual actions from database
    actions = db.query(AuditLog.action).distinct().all()
    if actions:
        return [a[0] for a in actions if a[0]]
    # Fallback to defaults
    return [
        "create", "update", "delete", "view",
        "login", "logout", "scan"
    ]


@router.get("/resource-types")
async def get_resource_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("audit.read"))
):
    """Get list of distinct resource types from actual data"""
    # Query actual resource types from database
    types = db.query(AuditLog.resource_type).distinct().all()
    if types:
        return [t[0] for t in types if t[0]]
    # Fallback to defaults
    return [
        "person", "field", "user", "role",
        "document", "settings"
    ]


@router.get("/users")
async def get_audit_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("audit.read"))
):
    """Get list of users who have audit entries"""
    # Get distinct user IDs with their emails
    users = db.query(User.id, User.email, User.full_name)\
        .join(AuditLog, AuditLog.user_id == User.id)\
        .distinct()\
        .order_by(User.email)\
        .all()

    return [
        {"id": str(u[0]), "email": u[1], "full_name": u[2]}
        for u in users
    ]


@router.get("/stats")
async def get_audit_stats(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("audit.read"))
):
    """Get audit log statistics"""
    from sqlalchemy import func

    cutoff = datetime.utcnow() - timedelta(days=days)

    # Total events
    total = db.query(func.count(AuditLog.id))\
        .filter(AuditLog.created_at >= cutoff)\
        .scalar()

    # Events by action
    by_action = dict(
        db.query(AuditLog.action, func.count(AuditLog.id))\
        .filter(AuditLog.created_at >= cutoff)\
        .group_by(AuditLog.action)\
        .all()
    )

    # Events by resource type
    by_resource = dict(
        db.query(AuditLog.resource_type, func.count(AuditLog.id))\
        .filter(AuditLog.created_at >= cutoff)\
        .group_by(AuditLog.resource_type)\
        .all()
    )

    # Top users
    top_users = db.query(AuditLog.user_id, User.email, func.count(AuditLog.id).label('count'))\
        .join(User, AuditLog.user_id == User.id)\
        .filter(AuditLog.created_at >= cutoff)\
        .group_by(AuditLog.user_id, User.email)\
        .order_by(desc('count'))\
        .limit(10)\
        .all()

    return {
        "period_days": days,
        "total_events": total,
        "by_action": by_action,
        "by_resource_type": by_resource,
        "top_users": [
            {"user_id": str(u[0]), "email": u[1], "event_count": u[2]}
            for u in top_users
        ]
    }


@router.get("/export")
async def export_audit_logs(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("audit.export"))
):
    """Export audit logs as CSV"""
    query = db.query(AuditLog)

    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    logs = query.order_by(desc(AuditLog.created_at)).all()

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Timestamp", "User Email", "Action", "Resource Type",
        "Resource ID", "IP Address", "Old Value", "New Value"
    ])

    # Data
    for log in logs:
        writer.writerow([
            to_local_time(log.created_at).isoformat(),
            log.user.email if log.user else "",
            log.action,
            log.resource_type,
            str(log.resource_id) if log.resource_id else "",
            str(log.ip_address) if log.ip_address else "",
            str(log.old_value) if log.old_value else "",
            str(log.new_value) if log.new_value else ""
        ])

    # Return as streaming response
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/{log_id}")
async def get_audit_log(
    log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("audit.read"))
):
    """Get a single audit log entry"""
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()

    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")

    return {
        "id": log.id,
        "user_id": log.user_id,
        "user_email": log.user.email if log.user else None,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "old_value": log.old_value,
        "new_value": log.new_value,
        "ip_address": str(log.ip_address) if log.ip_address else None,
        "user_agent": log.user_agent,
        "created_at": to_local_time(log.created_at).isoformat()
    }
