"""Create dnc_numbers table.

Revision ID: 003_create_dnc_numbers
Revises: 002_add_missing_indexes
Create Date: 2026-03-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "003_create_dnc_numbers"
down_revision = "002_add_missing_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dnc_numbers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phone_number", sa.String(50), nullable=False),
        sa.Column("added_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dnc_numbers_organization_id", "dnc_numbers", ["organization_id"])
    op.create_index("ix_dnc_numbers_phone_number", "dnc_numbers", ["phone_number"])
    op.create_unique_constraint("uq_dnc_org_phone", "dnc_numbers", ["organization_id", "phone_number"])

    # Migrate existing DNC data from organizations.settings->>'dnc_list' JSON
    op.execute(
        """
        INSERT INTO dnc_numbers (id, organization_id, phone_number)
        SELECT
            gen_random_uuid(),
            o.id,
            trim(both '"' from dnc_entry::text)
        FROM organizations o,
             jsonb_array_elements(o.settings->'dnc_list') AS dnc_entry
        WHERE o.settings IS NOT NULL
          AND o.settings ? 'dnc_list'
          AND jsonb_array_length(o.settings->'dnc_list') > 0
        ON CONFLICT ON CONSTRAINT uq_dnc_org_phone DO NOTHING
        """
    )


def downgrade() -> None:
    # Migrate data back to organizations.settings JSON before dropping table
    op.execute(
        """
        UPDATE organizations o
        SET settings = jsonb_set(
            COALESCE(o.settings, '{}'::jsonb),
            '{dnc_list}',
            COALESCE(
                (SELECT jsonb_agg(d.phone_number)
                 FROM dnc_numbers d
                 WHERE d.organization_id = o.id),
                '[]'::jsonb
            )
        )
        WHERE EXISTS (SELECT 1 FROM dnc_numbers d WHERE d.organization_id = o.id)
        """
    )
    op.drop_constraint("uq_dnc_org_phone", "dnc_numbers", type_="unique")
    op.drop_index("ix_dnc_numbers_phone_number", table_name="dnc_numbers")
    op.drop_index("ix_dnc_numbers_organization_id", table_name="dnc_numbers")
    op.drop_table("dnc_numbers")
