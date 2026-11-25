import time

from pydantic import BaseModel, Field


class PropertyMeta(BaseModel):
    name: str
    data_type: str  # string, integer, float, timestamp, boolean
    description: str | None = ""
    is_primary_key: bool = False
    is_title: bool = False
    formula: str | None = None  # Optional calculated/virtual property


class ObjectType(BaseModel):
    name: str  # e.g. "Customer", "Order", "Product", "Flight", "Warehouse"
    display_name: str | None = None
    description: str | None = ""
    primary_key: str  # e.g. "customer_id", "order_id"
    title_property: str | None = None  # property used as display label
    backed_by_table: str  # Underlying DuckDB / SQL table name
    properties: list[PropertyMeta] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    created_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )
