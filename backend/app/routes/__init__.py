from fastapi import APIRouter
from .auth import router as auth_router
from .users import router as users_router
from .roles import router as roles_router
from .fields import router as fields_router
from .persons import router as persons_router
from .recognition import router as recognition_router
from .documents import router as documents_router
from .audit import router as audit_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(roles_router, prefix="/roles", tags=["Roles"])
api_router.include_router(fields_router, prefix="/fields", tags=["Field Definitions"])
api_router.include_router(persons_router, prefix="/persons", tags=["Persons"])
api_router.include_router(recognition_router, prefix="/recognition", tags=["Recognition"])
api_router.include_router(documents_router, prefix="/documents", tags=["Documents"])
api_router.include_router(audit_router, prefix="/audit", tags=["Audit Logs"])
