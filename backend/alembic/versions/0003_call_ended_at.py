"""call_ended_at on transfers (hang up before Continue anyway)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-20
"""
import sqlalchemy as sa
from alembic import op

import app.models

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("transfers") as batch:
        batch.add_column(sa.Column("call_ended_at", app.models.UTCDateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table("transfers") as batch:
        batch.drop_column("call_ended_at")
