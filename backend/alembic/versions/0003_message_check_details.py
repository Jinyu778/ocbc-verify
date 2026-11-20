"""message check details: source, claimed sender, scam type, rule pack, feedback, training flag

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-20
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

COLUMNS = [
    sa.Column("source_channel", sa.String(length=16), nullable=True),
    sa.Column("claimed_sender", sa.String(length=120), nullable=True),
    sa.Column("scam_type", sa.String(length=32), nullable=True),
    sa.Column("rule_pack_version", sa.String(length=16), nullable=True),
    sa.Column("user_feedback", sa.String(length=16), nullable=True),
    sa.Column("training_candidate", sa.Boolean(), nullable=False, server_default=sa.false()),
]


def upgrade():
    with op.batch_alter_table("message_checks") as batch:
        for c in COLUMNS:
            batch.add_column(c)


def downgrade():
    with op.batch_alter_table("message_checks") as batch:
        for c in COLUMNS:
            batch.drop_column(c.name)
