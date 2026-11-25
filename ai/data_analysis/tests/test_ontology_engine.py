import pytest
from fastapi.testclient import TestClient

from data_analysis.config import settings

settings.API_KEYS = "test-api-key"

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.main import app
from data_analysis.mcp_server import (
    ontology_list_schema,
    ontology_query_objects,
    ontology_traverse_links,
)
from data_analysis.ontology.action_type import ActionParameter, ActionType
from data_analysis.ontology.link_type import LinkType
from data_analysis.ontology.object_type import ObjectType, PropertyMeta
from data_analysis.ontology.ontology_engine import get_ontology_engine

client = TestClient(app, headers={"X-API-Key": "test-api-key"})


@pytest.fixture
def ontology_session():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("ontology_test_session")
    con = sess.get_duckdb_conn()
    con.execute("""
    CREATE TABLE IF NOT EXISTS dim_customers (
        customer_id VARCHAR PRIMARY KEY,
        name VARCHAR,
        tier VARCHAR,
        balance DOUBLE
    );
    DELETE FROM dim_customers;
    INSERT INTO dim_customers VALUES
    ('C01', 'Alice', 'VIP', 1000.0),
    ('C02', 'Bob', 'STANDARD', 250.0);

    CREATE TABLE IF NOT EXISTS fct_orders (
        order_id VARCHAR PRIMARY KEY,
        customer_id VARCHAR,
        amount DOUBLE,
        status VARCHAR
    );
    DELETE FROM fct_orders;
    INSERT INTO fct_orders VALUES
    ('O101', 'C01', 300.0, 'DELIVERED'),
    ('O102', 'C01', 700.0, 'PENDING'),
    ('O103', 'C02', 150.0, 'DELIVERED');
    """)
    return con


def test_ontology_schema_registration():
    engine = get_ontology_engine()

    # 1. Register Customer Object
    customer_obj = ObjectType(
        name="Customer",
        display_name="客户实体",
        description="企业客户核心实体",
        primary_key="customer_id",
        title_property="name",
        backed_by_table="dim_customers",
        properties=[
            PropertyMeta(name="customer_id", data_type="string", is_primary_key=True),
            PropertyMeta(name="name", data_type="string", is_title=True),
            PropertyMeta(name="tier", data_type="string"),
            PropertyMeta(name="balance", data_type="float"),
        ],
        tags=["core", "crm"],
    )
    engine.register_object_type(customer_obj)

    # 2. Register Order Object
    order_obj = ObjectType(
        name="Order",
        display_name="订单实体",
        primary_key="order_id",
        backed_by_table="fct_orders",
        properties=[
            PropertyMeta(name="order_id", data_type="string", is_primary_key=True),
            PropertyMeta(name="customer_id", data_type="string"),
            PropertyMeta(name="amount", data_type="float"),
            PropertyMeta(name="status", data_type="string"),
        ],
    )
    engine.register_object_type(order_obj)

    # 3. Register Link Type: Customer -> Orders
    link = LinkType(
        name="customer_orders",
        display_name="客户名下订单",
        source_object_type="Customer",
        target_object_type="Order",
        cardinality="ONE_TO_MANY",
        source_join_key="customer_id",
        target_join_key="customer_id",
    )
    engine.register_link_type(link)

    # 4. Register Action Type
    action = ActionType(
        name="UpgradeCustomerTierAction",
        display_name="升级客户会员等级",
        target_object_type="Customer",
        parameters=[
            ActionParameter(name="new_tier", data_type="string", required=True),
            ActionParameter(
                name="reason",
                data_type="string",
                required=False,
                default_value="Agent Retention Campaign",
            ),
        ],
        handler_type="SQL_MUTATION",
        handler_config={
            "sql_template": "UPDATE dim_customers SET tier = '{new_tier}' WHERE customer_id = '{instance_id}'"
        },
    )
    engine.register_action_type(action)

    schema_summary = engine.get_ontology_schema_summary()
    assert len(schema_summary["object_types"]) >= 2
    assert len(schema_summary["link_types"]) >= 1


def test_ontology_query_and_traversal(ontology_session):
    engine = get_ontology_engine()

    # Query Customer instances
    res = engine.query_object_instances(
        con=ontology_session, object_type_name="Customer", filters="tier = 'VIP'"
    )
    assert res["total_instances"] == 1
    assert res["instances"][0]["customer_id"] == "C01"

    # Traverse Link: Customer C01 -> Orders
    trav_res = engine.traverse_links(
        con=ontology_session,
        source_object_type="Customer",
        source_instance_id="C01",
        link_name="customer_orders",
    )
    assert trav_res["target_object_type"] == "Order"
    assert trav_res["linked_count"] == 2
    order_ids = [o["order_id"] for o in trav_res["linked_instances"]]
    assert "O101" in order_ids and "O102" in order_ids


def test_ontology_action_execution_and_audit(ontology_session):
    engine = get_ontology_engine()

    # Execute Action: Upgrade Customer C02 tier to 'GOLD'
    audit = engine.execute_action(
        con=ontology_session,
        action_name="UpgradeCustomerTierAction",
        instance_id="C02",
        parameter_values={"new_tier": "GOLD", "reason": "High LTV growth"},
    )
    assert audit["status"] == "SUCCESS"
    assert audit["action_name"] == "UpgradeCustomerTierAction"
    assert audit["target_instance_id"] == "C02"

    # Verify DuckDB mutation executed
    new_tier = ontology_session.execute(
        "SELECT tier FROM dim_customers WHERE customer_id = 'C02'"
    ).fetchone()[0]
    assert new_tier == "GOLD"

    # Verify persistent audit trail
    audits = engine.list_action_audits(limit=10)
    assert len(audits) >= 1
    assert audits[0]["action_name"] == "UpgradeCustomerTierAction"


def test_ontology_mcp_and_api(ontology_session):
    # MCP schema
    schema_json = ontology_list_schema()
    assert "Customer" in schema_json

    # MCP query
    query_json = ontology_query_objects(
        session_id="ontology_test_session", object_type="Customer", filters="customer_id = 'C01'"
    )
    assert "Alice" in query_json

    # MCP traverse
    trav_json = ontology_traverse_links(
        session_id="ontology_test_session",
        source_object_type="Customer",
        source_instance_id="C01",
        link_name="customer_orders",
    )
    assert "O101" in trav_json

    # REST endpoint
    resp = client.get("/api/v1/ontology/schema")
    assert resp.status_code == 200
    assert "object_types" in resp.json()
