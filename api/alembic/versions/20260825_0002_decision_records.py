"""Add immutable human decision records.

Revision ID: 20260825_0002
Revises: 20260824_0001
"""

from alembic import op
import sqlalchemy as sa


revision = "20260825_0002"
down_revision = "20260824_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "decision_records" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "decision_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("opportunity_id", sa.String(length=36), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("next_step", sa.Text(), nullable=False),
        sa.Column("evidence_item_ids", sa.JSON(), nullable=False),
        sa.Column("source_fragment_ids", sa.JSON(), nullable=False),
        sa.Column("contradiction_ids", sa.JSON(), nullable=False),
        sa.Column("challenge_run_ids", sa.JSON(), nullable=False),
        sa.Column("reviewed_evidence_count", sa.Integer(), nullable=False),
        sa.Column("unresolved_evidence_count", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("supersedes_decision_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supersedes_decision_id"], ["decision_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_records_workspace_id"), "decision_records", ["workspace_id"], unique=False)
    op.create_index(op.f("ix_decision_records_opportunity_id"), "decision_records", ["opportunity_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if "decision_records" not in sa.inspect(bind).get_table_names():
        return
    op.drop_index(op.f("ix_decision_records_opportunity_id"), table_name="decision_records")
    op.drop_index(op.f("ix_decision_records_workspace_id"), table_name="decision_records")
    op.drop_table("decision_records")
