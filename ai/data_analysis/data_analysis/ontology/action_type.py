import time
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def utc_stamp() -> str:
    """UTC time with microseconds so two audits in the same second stay ordered."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class ActionParameter(BaseModel):
    name: str
    data_type: str  # string, integer, float, boolean, json
    description: str | None = ""
    required: bool = True
    default_value: Any | None = None


class ActionType(BaseModel):
    name: str  # e.g. "ApplyDiscountAction", "RerouteShipmentAction", "SendRetentionCouponAction"
    display_name: str | None = None
    description: str | None = ""
    target_object_type: str  # The entity type this action operates upon (e.g. "Customer", "Order")
    parameters: list[ActionParameter] = Field(default_factory=list)
    handler_type: str = "WEBHOOK"  # WEBHOOK, REVERSE_ETL_SYNC, SQL_MUTATION
    handler_config: dict[str, Any] = Field(default_factory=dict)
    # E.g. {"webhook_url": "http...", "platform": "feishu"} or {"sql_template": "UPDATE orders SET status = ..."}
    created_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )


class ActionExecutionAudit(BaseModel):
    audit_id: str
    action_name: str
    target_object_type: str
    target_instance_id: str
    parameters: dict[str, Any]
    status: str  # SUCCESS, FAILED, SIMULATED
    execution_result: dict[str, Any] = Field(default_factory=dict)
    executed_at: str = Field(default_factory=utc_stamp)
