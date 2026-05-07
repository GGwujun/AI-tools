"""add lof optimization fields

Revision ID: 0002_add_lof_optimization_fields
Revises: 0001_baseline_current_state
Create Date: 2026-05-07 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0002_add_lof_optimization_fields"
down_revision = "0001_baseline_current_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # FundSnapshot: 扩展行情字段
    op.add_column("fund_snapshots", sa.Column("volume", sa.Float(), nullable=True))
    op.add_column("fund_snapshots", sa.Column("amount", sa.Float(), nullable=True))
    op.add_column("fund_snapshots", sa.Column("open_price", sa.Float(), nullable=True))
    op.add_column("fund_snapshots", sa.Column("high_price", sa.Float(), nullable=True))
    op.add_column("fund_snapshots", sa.Column("low_price", sa.Float(), nullable=True))
    op.add_column("fund_snapshots", sa.Column("prev_close", sa.Float(), nullable=True))
    op.add_column("fund_snapshots", sa.Column("total_market_cap", sa.Float(), nullable=True))

    # FundSnapshot: 估算溢价率
    op.add_column("fund_snapshots", sa.Column("estimate_premium_rate", sa.Float(), nullable=True))

    # FundSnapshot: 申购限额
    op.add_column("fund_snapshots", sa.Column("purchase_limit_amount", sa.Float(), nullable=True))
    op.add_column("fund_snapshots", sa.Column("purchase_limit_display", sa.String(64), nullable=False, server_default="--"))

    # OpportunitySnapshot: 估算溢价率
    op.add_column("opportunity_snapshots", sa.Column("estimate_premium_rate", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("opportunity_snapshots", "estimate_premium_rate")

    op.drop_column("fund_snapshots", "purchase_limit_display")
    op.drop_column("fund_snapshots", "purchase_limit_amount")
    op.drop_column("fund_snapshots", "estimate_premium_rate")

    op.drop_column("fund_snapshots", "total_market_cap")
    op.drop_column("fund_snapshots", "prev_close")
    op.drop_column("fund_snapshots", "low_price")
    op.drop_column("fund_snapshots", "high_price")
    op.drop_column("fund_snapshots", "open_price")
    op.drop_column("fund_snapshots", "amount")
    op.drop_column("fund_snapshots", "volume")