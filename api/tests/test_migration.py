from __future__ import annotations

import os
import subprocess
from pathlib import Path


def test_alembic_upgrade_head_on_fresh_database(tmp_path: Path):
    database = tmp_path / "migration.db"
    env = {**os.environ, "SIGNAL_GARDEN_DATABASE_URL": f"sqlite:///{database}"}
    result = subprocess.run([".venv/bin/alembic", "upgrade", "head"], cwd=Path(__file__).parents[1], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    current = subprocess.run([".venv/bin/alembic", "current"], cwd=Path(__file__).parents[1], env=env, capture_output=True, text=True)
    assert current.returncode == 0
    assert "20260824_0001" in current.stdout
