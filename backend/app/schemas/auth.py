"""
Authentication Schemas
======================
Pydantic models for auth requests/responses.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID


class LoginRequest(BaseModel):
    """Login request body"""
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginResponse(BaseModel):
    """Login response with tokens"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class RefreshRequest(BaseModel):
    """Token refresh request"""
    refresh_token: str


class RefreshResponse(BaseModel):
    """Token refresh response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RegisterRequest(BaseModel):
    """User registration request"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    phone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """Password change request"""
    current_password: str
    new_password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    """User response (without sensitive data)"""
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    is_active: bool
    is_superadmin: bool
    roles: list = []

    class Config:
        from_attributes = True


# Update forward reference
LoginResponse.model_rebuild()
