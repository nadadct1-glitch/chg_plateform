"""
Mise en place de SQLAlchemy : moteur de connexion, fabrique de sessions et
classe de base déclarative dont hériteront tous les modèles (app/models.py).

C'est ICI, directement en code Python (comme demandé), que se trouve toute
la mécanique de connexion à PostgreSQL. La création réelle des tables se
fait au démarrage de l'application (voir app/main.py -> Base.metadata.create_all).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db():
    """Dépendance FastAPI : fournit une session DB et la ferme après usage."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
