"""
Authentication Service
======================
Handles JWT token creation, validation, and password hashing.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenPayload(BaseModel):
    """JWT token payload"""
    sub: str  # user_id
    exp: datetime
    type: str  # "access" or "refresh"


class TokenPair(BaseModel):
    """Access and refresh token pair"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthService:
    """Service for authentication operations"""

    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt"""
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)

    def create_access_token(self, user_id: str) -> str:
        """Create a new access token"""
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": str(user_id),
            "exp": expire,
            "type": "access"
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    def create_refresh_token(self, user_id: str) -> str:
        """Create a new refresh token"""
        expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        payload = {
            "sub": str(user_id),
            "exp": expire,
            "type": "refresh"
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    def create_token_pair(self, user_id: str) -> TokenPair:
        """Create both access and refresh tokens"""
        return TokenPair(
            access_token=self.create_access_token(user_id),
            refresh_token=self.create_refresh_token(user_id),
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    def verify_token(self, token: str) -> Optional[TokenPayload]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            return TokenPayload(
                sub=payload["sub"],
                exp=datetime.fromtimestamp(payload["exp"]),
                type=payload.get("type", "access")
            )
        except JWTError as e:
            logger.debug(f"Token verification failed: {e}")
            return None

    def verify_access_token(self, token: str) -> Optional[str]:
        """Verify an access token and return user_id"""
        payload = self.verify_token(token)
        if payload and payload.type == "access":
            return payload.sub
        return None

    def verify_refresh_token(self, token: str) -> Optional[str]:
        """Verify a refresh token and return user_id"""
        payload = self.verify_token(token)
        if payload and payload.type == "refresh":
            return payload.sub
        return None

    def refresh_tokens(self, refresh_token: str) -> Optional[TokenPair]:
        """Use refresh token to get new token pair"""
        user_id = self.verify_refresh_token(refresh_token)
        if user_id:
            return self.create_token_pair(user_id)
        return None
