#!/bin/sh
set -eu

mkdir -p /data /workspace
chown -R interpres:interpres /data /workspace

gosu interpres alembic upgrade head
exec gosu interpres uvicorn app.main:app --host 0.0.0.0 --port 8000
