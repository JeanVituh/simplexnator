"""Configuração do backend (variáveis de ambiente)."""
import os

try:  # carrega backend/.env quando python-dotenv está instalado
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # pragma: no cover
    pass


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


class Settings:
    max_variables = _int("MAX_VARIABLES", 12)
    max_constraints = _int("MAX_CONSTRAINTS", 20)
    bb_node_limit = _int("BB_NODE_LIMIT", 2000)
    bb_tableau_limit = _int("BB_TABLEAU_LIMIT", 150)
    cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]


settings = Settings()
