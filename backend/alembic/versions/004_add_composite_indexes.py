"""Add composite indexes for common query patterns.

Revision ID: 004_add_composite_indexes
Revises: 003_create_dnc_numbers
Create Date: 2026-03-27
"""
from alembic import op

revision = "004_add_composite_indexes"
down_revision = "003_create_dnc_numbers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_leads_org_status",
        "leads",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_calls_org_status",
        "calls",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_calls_org_created",
        "calls",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_campaigns_org_status",
        "campaigns",
        ["organization_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_campaigns_org_status", table_name="campaigns")
    op.drop_index("ix_calls_org_created", table_name="calls")
    op.drop_index("ix_calls_org_status", table_name="calls")
    op.drop_index("ix_leads_org_status", table_name="leads")
