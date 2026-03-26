"""Add unique constraint to agent_knowledge_bases.

Revision ID: 005_add_agent_knowledge_unique
Revises: 004_add_composite_indexes
Create Date: 2026-03-27
"""
from alembic import op

revision = "005_add_agent_knowledge_unique"
down_revision = "004_add_composite_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_agent_knowledge",
        "agent_knowledge_bases",
        ["voice_agent_id", "knowledge_document_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_agent_knowledge", "agent_knowledge_bases", type_="unique")
