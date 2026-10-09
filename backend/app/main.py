"""
Application principale — Plateforme CHG (Concorde Holding Group).

Au démarrage :
  1. `Base.metadata.create_all(engine)` crée toutes les tables PostgreSQL
     décrites dans app/models.py si elles n'existent pas encore.
  2. `seed_data.run_all_seeds(db)` importe le contenu réel des documents
     fournis (domaines, projets, processus de création) et crée le compte
     administrateur initial, uniquement si la base est encore vide.

Lancement :
    uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from . import models, seed_data
from .config import settings
from .database import Base, SessionLocal, engine
from .routers import (
    activity, auth, chat, content, dashboard, finances, meetings, process, registrations, tasks, uploads, users,
)

BACKEND_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = (BACKEND_DIR.parent / "frontend").resolve()
UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1) Création des tables (si elles n'existent pas déjà)
    Base.metadata.create_all(bind=engine)
    # 1bis) Petites migrations idempotentes pour les installations déjà existantes
    # (create_all ne modifie jamais une table déjà présente : les nouvelles
    # colonnes ajoutées aux modèles après le premier déploiement doivent être
    # ajoutées explicitement ici, sans jamais toucher aux données existantes).
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes TEXT"))
    # 2) Amorçage des données de référence (idempotent)
    db = SessionLocal()
    try:
        seed_data.run_all_seeds(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=f"{settings.org_name} - Plateforme Intégrée de Gestion",
    description="API de la plateforme de gestion du conglomérat CHG.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Système"])
def health_check():
    return {"status": "ok", "organisation": settings.org_name}


# --- Routes API ---
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(meetings.router)
app.include_router(chat.router)
app.include_router(registrations.router)
app.include_router(process.router)
app.include_router(content.router)
app.include_router(dashboard.router)
app.include_router(finances.router)
app.include_router(activity.router)
app.include_router(uploads.router)


# --- Frontend statique (HTML / CSS / JS / PWA) ---
# Montages spécifiques d'abord, puis la racine en dernier (elle capte tout le reste).
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
if FRONTEND_DIR.exists():
    for sub in ("css", "js", "assets", "icons"):
        sub_path = FRONTEND_DIR / sub
        if sub_path.exists():
            app.mount(f"/{sub}", StaticFiles(directory=sub_path), name=sub)
    for sub in ("app", "admin"):
        sub_path = FRONTEND_DIR / sub
        if sub_path.exists():
            app.mount(f"/{sub}", StaticFiles(directory=sub_path, html=True), name=sub)
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="root")
