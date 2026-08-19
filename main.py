"""Compatibility entrypoint for local uvicorn commands.

The real FastAPI application lives in backend.main. This file lets
`uvicorn main:app` work from the project root, which is the command many
developers try first.
"""
from backend.main import app

