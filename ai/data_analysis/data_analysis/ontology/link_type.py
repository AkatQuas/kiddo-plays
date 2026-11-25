import time

from pydantic import BaseModel, Field


class LinkType(BaseModel):
    name: str  # e.g. "customer_orders", "order_items", "order_warehouse"
    display_name: str | None = None
    description: str | None = ""
    source_object_type: str  # e.g. "Customer"
    target_object_type: str  # e.g. "Order"
    cardinality: str = "ONE_TO_MANY"  # ONE_TO_ONE, ONE_TO_MANY, MANY_TO_ONE, MANY_TO_MANY
    # Join specification: how source table relates to target table
    source_join_key: str  # e.g. "customer_id" in Customer
    target_join_key: str  # e.g. "customer_id" in Order
    # MANY_TO_MANY goes through an association table. Direct joins stay the default.
    junction_table: str | None = None
    junction_source_key: str | None = None
    junction_target_key: str | None = None
    created_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )
