"""Add missing foreign key indexes.

Revision ID: 002_add_missing_indexes
Revises: 001_initial
Create Date: 2026-03-27
"""
from alembic import op

revision = "002_add_missing_indexes"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_agent_knowledge_bases_knowledge_document_id",
        "agent_knowledge_bases",
        ["knowledge_document_id"],
    )
    op.create_index(
        "ix_ab_test_results_variant_id",
        "ab_test_results",
        ["variant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ab_test_results_variant_id", table_name="ab_test_results")
    op.drop_index("ix_agent_knowledge_bases_knowledge_document_id", table_name="agent_knowledge_bases")
