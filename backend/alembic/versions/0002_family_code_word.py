"""family code word hash on users

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-14
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("family_code_word_hash", sa.String(length=128), nullable=True))


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("family_code_word_hash")
