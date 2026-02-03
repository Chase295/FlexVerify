# FlexVerify - Dynamic Identity & Compliance Platform

## Projektübersicht

FlexVerify ist eine eigenständige Plattform für Identitätsmanagement und Compliance-Überprüfung mit Gesichtserkennung. Das System besteht aus drei Portalen:

1. **Super Admin Portal** - Feld-, Benutzer- und Rollenverwaltung
2. **Verwaltungs-Portal** - Personenverwaltung mit dynamischen Feldern
3. **Scanner PWA** - Mobile Gesichts-/QR-/Text-Erkennung

## Projektstruktur

```
FlexVerify/
├── backend/                          # FastAPI Backend
│   ├── app/
│   │   ├── config/
│   │   │   ├── database.py          # PostgreSQL + pgvector Setup
│   │   │   └── settings.py          # Pydantic Settings
│   │   ├── middleware/
│   │   │   └── auth.py              # JWT Auth Middleware
│   │   ├── models/
│   │   │   ├── user.py              # Benutzer mit RBAC
│   │   │   ├── role.py              # Rollen mit Berechtigungen
│   │   │   ├── person.py            # Personen mit Face-Vektoren
│   │   │   ├── field_definition.py  # Dynamische Felddefinitionen
│   │   │   ├── document.py          # Dokument-Uploads
│   │   │   ├── scan_event.py        # Scan-Protokoll
│   │   │   └── audit_log.py         # Audit-Trail
│   │   ├── routes/
│   │   │   ├── auth.py              # Login, Register, Refresh
│   │   │   ├── users.py             # Benutzerverwaltung
│   │   │   ├── roles.py             # Rollenverwaltung
│   │   │   ├── fields.py            # Felddefinitionen CRUD
│   │   │   ├── persons.py           # Personenverwaltung
│   │   │   ├── recognition.py       # Face/QR/Text-Suche
│   │   │   ├── documents.py         # Datei-Upload/Download
│   │   │   └── audit.py             # Audit-Log Abfragen
│   │   ├── schemas/                 # Pydantic Request/Response Schemas
│   │   ├── services/
│   │   │   ├── face_service.py      # Gesichtserkennung (dlib/HOG)
│   │   │   ├── auth_service.py      # JWT Token Management
│   │   │   ├── field_service.py     # Feld-Validierung
│   │   │   ├── person_service.py    # Person CRUD mit Vektoren
│   │   │   ├── validation_service.py # Compliance-Prüfung
│   │   │   └── audit_service.py     # Audit-Logging
│   │   └── main.py                  # FastAPI App Entry Point
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/                         # React + Tailwind Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/               # Super Admin Portal
│   │   │   │   ├── FieldManager.tsx
│   │   │   │   ├── UserManager.tsx
│   │   │   │   └── RoleManager.tsx
│   │   │   ├── management/          # Verwaltungs-Portal
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── PersonList.tsx
│   │   │   │   ├── PersonDetail.tsx
│   │   │   │   └── AuditLog.tsx
│   │   │   ├── scanner/             # Scanner PWA
│   │   │   │   └── ScannerHome.tsx
│   │   │   └── common/
│   │   │       ├── Login.tsx
│   │   │       └── Layout.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx      # Auth State Management
│   │   ├── services/
│   │   │   └── api.ts               # Axios mit Token Refresh
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript Interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docker-compose.yml               # Kompletter Stack
└── aeos-face-id-bridge/             # Legacy-Projekt (archiviert)
```

## Tech Stack

### Backend
- **FastAPI** - Web-Framework
- **SQLAlchemy 2.0** - ORM mit async Support
- **PostgreSQL 16 + pgvector** - Vektor-Datenbank für Gesichtserkennung
- **face_recognition** - Gesichtserkennung (dlib, HOG-Modell, keine GPU)
- **python-jose** - JWT Token Management
- **passlib + bcrypt** - Passwort-Hashing
- **Pydantic v2** - Validierung und Settings

### Frontend
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **Vite** - Build Tool
- **react-webcam** - Kamera-Zugriff
- **html5-qrcode** - QR-Code Scanner
- **PWA** - Offline-Fähigkeit für Scanner

### Datenbank
- **PostgreSQL 16** mit **pgvector** Extension
- **HNSW Index** für schnelle Vektorsuche
- **JSONB** für dynamische Felddaten

## Docker Setup

### Stack starten
```bash
cd /Users/moritzhaslbeck/Desktop/Projekte/FlexVerify
docker-compose up -d
```

### Container
| Service | Container | Port | Beschreibung |
|---------|-----------|------|--------------|
| db | flexverify-db | 5432 | PostgreSQL + pgvector |
| backend | flexverify-backend | 8000 | FastAPI API |
| frontend | flexverify-frontend | 3000 | React App (Vite) |

### Nützliche Commands
```bash
# Logs anzeigen
docker-compose logs -f backend

# Backend neu starten
docker-compose restart backend

# Alles stoppen
docker-compose down

# Alles löschen (inkl. Datenbank)
docker-compose down -v

# Backend neu bauen (nach requirements.txt Änderung)
docker-compose build backend && docker-compose up -d backend
```

## Zugriff

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Default Login
- **Email**: `admin@flexverify.dev`
- **Passwort**: `admin123`

## Gesichtserkennung

### Technische Details
- **Modell**: HOG (Histogram of Oriented Gradients) - keine GPU erforderlich
- **Vektor-Dimension**: 128 Floats
- **Ähnlichkeitssuche**: Euklidische Distanz mit pgvector
- **Threshold**: 0.6 (konfigurierbar)
- **Multi-Vektor**: Primary, Normalized, Grayscale Varianten

### FaceService Kernfunktionen
```python
# Vektor aus Bild extrahieren
vector = FaceService.extract_face_vector(image_bytes)  # Returns List[float] (128-dim)

# Mehrere Vektoren extrahieren (primary, normalized, grayscale)
vectors = FaceService.extract_multiple_face_vectors(image_bytes)

# Gesichter vergleichen
distance = FaceService.compare_faces(known_vector, unknown_vector)

# Confidence berechnen
confidence = FaceService.calculate_confidence(distance)  # 0-100%
```

### Vektor-Suche in PostgreSQL
```sql
-- HNSW Index für schnelle Suche
CREATE INDEX idx_persons_face_vector ON persons
USING hnsw (face_vector vector_l2_ops);

-- Ähnlichste Person finden
SELECT *, face_vector <-> '[0.1, 0.2, ...]' AS distance
FROM persons
WHERE face_vector IS NOT NULL
ORDER BY distance
LIMIT 1;
```

## API Endpoints

### Authentication
```
POST /api/auth/login          # Login, returns JWT tokens
POST /api/auth/register       # Neuen User registrieren
POST /api/auth/refresh        # Token erneuern
POST /api/auth/logout         # Logout
GET  /api/auth/me             # Aktueller User
```

### Persons
```
GET    /api/persons           # Liste (paginiert)
POST   /api/persons           # Neue Person anlegen
GET    /api/persons/{id}      # Person Details
PUT    /api/persons/{id}      # Person aktualisieren
DELETE /api/persons/{id}      # Person löschen (soft delete)
POST   /api/persons/{id}/photo # Foto hochladen + Vektor extrahieren
```

### Recognition (Scanner)
```
POST /api/recognition/face-search   # Gesicht suchen (multipart/form-data)
GET  /api/recognition/qr/{code}     # QR-Code Lookup
GET  /api/recognition/barcode/{code} # Barcode Lookup
GET  /api/recognition/text-search   # Text-Suche
```

### Fields (Admin)
```
GET    /api/fields            # Alle Felddefinitionen
POST   /api/fields            # Neues Feld anlegen
PUT    /api/fields/{id}       # Feld aktualisieren
DELETE /api/fields/{id}       # Feld löschen
```

### Users & Roles (Admin)
```
GET/POST/PUT/DELETE /api/users
GET/POST/PUT/DELETE /api/roles
```

## Dynamische Felder

### Feldtypen
- `text` - Freitext
- `number` - Zahlen
- `date` - Datum
- `boolean` - Ja/Nein
- `select` - Dropdown (options als JSON)
- `email` - E-Mail Validierung
- `phone` - Telefonnummer

### Feld-Konfiguration (JSON)
```json
{
  "name": "zertifikat_ablauf",
  "label": "Zertifikat Ablaufdatum",
  "field_type": "date",
  "is_required": true,
  "is_compliance_relevant": true,
  "expiry_warning_days": 30,
  "options": null,
  "depends_on": "hat_zertifikat",
  "depends_on_value": "true"
}
```

### Speicherung in Person
```python
# Dynamische Felder werden als JSONB gespeichert
person.field_data = {
    "zertifikat_ablauf": "2024-12-31",
    "hat_zertifikat": true,
    "abteilung": "IT"
}
```

## RBAC (Role-Based Access Control)

### Berechtigungen
```python
PERMISSIONS = [
    "persons:read", "persons:write", "persons:delete",
    "fields:read", "fields:write",
    "users:read", "users:write",
    "roles:read", "roles:write",
    "audit:read",
    "scanner:use"
]
```

### Rollen-Beispiele
- **Admin**: Alle Berechtigungen
- **Manager**: persons:*, audit:read
- **Scanner**: scanner:use, persons:read

### Field-Level Permissions
Rollen können definieren, welche Felder sichtbar/editierbar sind:
```python
role.visible_fields = ["name", "email", "abteilung"]
role.editable_fields = ["email"]
```

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://flexverify:flexverify123@db:5432/flexverify

# JWT
JWT_SECRET_KEY=your-secret-key-min-32-chars
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Face Recognition
FACE_RECOGNITION_THRESHOLD=0.6
FACE_RECOGNITION_MODEL=hog

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Superadmin
SUPERADMIN_EMAIL=admin@flexverify.dev
SUPERADMIN_PASSWORD=admin123
```

## Entwicklung (ohne Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Datenbank (lokal)
```bash
# PostgreSQL mit pgvector starten
docker run -d --name flexverify-db \
  -e POSTGRES_USER=flexverify \
  -e POSTGRES_PASSWORD=flexverify123 \
  -e POSTGRES_DB=flexverify \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

## Wichtige Hinweise

### Face Recognition Dependencies
Das Backend-Image braucht dlib, was beim ersten Build kompiliert wird (~5 Min). Der Build ist gecached.

### bcrypt Version
Verwende bcrypt 4.0.1 (nicht 5.x) wegen Kompatibilität mit passlib:
```
bcrypt==4.0.1
```

### Email Validation
`email-validator` akzeptiert keine `.local` Domains. Verwende `.dev` oder echte Domains.

### CORS Origins
Werden als komma-separierter String übergeben und automatisch geparst:
```python
CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://localhost:5173"
```

## Legacy-Projekt

Das alte AEOS-Projekt befindet sich in `/aeos-face-id-bridge/` und enthält:
- AEOS SOAP Integration
- Signature Pad / Kiosk Feature
- Legacy Employee-Synchronisation

Dieses Projekt ist archiviert und wird nicht mehr aktiv entwickelt.
