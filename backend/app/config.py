"""
Configuration centrale de l'application.

Tous les paramètres sont lus depuis les variables d'environnement (ou un
fichier .env à la racine de /backend). Voir .env.example pour la liste
complète des variables disponibles.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Base de données PostgreSQL ---
    database_url: str = (
        "postgresql+psycopg2://chg_user:chg_password@localhost:5432/chg_platform"
    )

    # --- Sécurité / JWT ---
    secret_key: str = "changez-cette-cle-secrete-en-production-chg-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12 heures

    # --- Compte administrateur créé automatiquement au premier démarrage ---
    first_admin_username: str = "admin"
    first_admin_password: str = "ChangeMoi123!"
    first_admin_email: str = "admin@concordeholding.tg"

    # --- CORS (origines autorisées pour le frontend) ---
    cors_origins: str = "*"

    # --- Organisation ---
    org_name: str = "Concorde Holding Group"
    org_short_name: str = "CHG"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
