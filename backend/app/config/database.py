from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
import logging

from .settings import settings

logger = logging.getLogger(__name__)

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database with all tables and extensions"""
    from sqlalchemy import text

    with engine.connect() as conn:
        # Enable pgvector extension
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))  # For fuzzy text search
            conn.commit()
            logger.info("PostgreSQL extensions enabled: vector, pg_trgm")
        except Exception as e:
            logger.warning(f"Could not create extensions (may already exist): {e}")

    # Import all models to register them
    from app.models import User, Role, FieldDefinition, Person, Document, ScanEvent, AuditLog

    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")


def create_superadmin():
    """Create default superadmin user if not exists"""
    from app.models import User
    from app.services.auth_service import AuthService

    db = SessionLocal()
    auth_service = AuthService()

    try:
        # Check if superadmin exists
        existing = db.query(User).filter(User.email == settings.SUPERADMIN_EMAIL).first()
        if not existing:
            superadmin = User(
                email=settings.SUPERADMIN_EMAIL,
                password_hash=auth_service.hash_password(settings.SUPERADMIN_PASSWORD),
                full_name="Super Admin",
                is_active=True,
                is_superadmin=True
            )
            db.add(superadmin)
            db.commit()
            logger.info(f"Superadmin created: {settings.SUPERADMIN_EMAIL}")
        else:
            logger.info("Superadmin already exists")
    except Exception as e:
        logger.error(f"Error creating superadmin: {e}")
        db.rollback()
    finally:
        db.close()


# System field definitions - these are the core person fields
SYSTEM_FIELDS = [
    {
        "name": "first_name",
        "label": "Vorname",
        "field_type": "text",
        "category": "Stammdaten",
        "field_order": 1,
        "is_required": False,
        "is_system": True,
        "configuration": {"max_length": 255, "placeholder": "Vorname eingeben"},
    },
    {
        "name": "last_name",
        "label": "Nachname",
        "field_type": "text",
        "category": "Stammdaten",
        "field_order": 2,
        "is_required": True,  # Only required field
        "is_system": True,
        "configuration": {"max_length": 255, "placeholder": "Nachname eingeben"},
    },
    {
        "name": "email",
        "label": "E-Mail",
        "field_type": "email",
        "category": "Stammdaten",
        "field_order": 3,
        "is_required": False,
        "is_system": True,
        "configuration": {},
    },
    {
        "name": "phone",
        "label": "Telefon",
        "field_type": "text",
        "category": "Stammdaten",
        "field_order": 4,
        "is_required": False,
        "is_system": True,
        "configuration": {"placeholder": "+49 123 456789"},
    },
    {
        "name": "personnel_number",
        "label": "Personalnummer",
        "field_type": "text",
        "category": "Identifikation",
        "field_order": 10,
        "is_required": False,
        "is_system": True,
        "is_searchable": True,
        "configuration": {},
    },
    # DISABLED: QR/Barcode system fields temporarily disabled
    # {
    #     "name": "qr_code",
    #     "label": "QR-Code",
    #     "field_type": "qr_code",
    #     "category": "Identifikation",
    #     "field_order": 11,
    #     "is_required": False,
    #     "is_system": True,
    #     "is_unique": True,
    #     "configuration": {"generate_on_create": False},
    # },
    # {
    #     "name": "barcode",
    #     "label": "Barcode",
    #     "field_type": "barcode",
    #     "category": "Identifikation",
    #     "field_order": 12,
    #     "is_required": False,
    #     "is_system": True,
    #     "is_unique": True,
    #     "configuration": {"format": "auto"},
    # },
]


def init_system_fields():
    """Initialize or update system fields in database"""
    from app.models import FieldDefinition

    db = SessionLocal()

    try:
        for field_data in SYSTEM_FIELDS:
            existing = db.query(FieldDefinition).filter(
                FieldDefinition.name == field_data["name"]
            ).first()

            if not existing:
                # Create new system field
                field = FieldDefinition(**field_data)
                db.add(field)
                logger.info(f"System field created: {field_data['name']}")
            else:
                # Update existing field but preserve user customizations for label/category
                # Only enforce is_system flag
                if not existing.is_system:
                    existing.is_system = True
                    logger.info(f"System field marked: {field_data['name']}")

        db.commit()
        logger.info("System fields initialized")
    except Exception as e:
        logger.error(f"Error initializing system fields: {e}")
        db.rollback()
    finally:
        db.close()
