"""Slice: catalog asset -> object/link model -> entity graph -> drill-down."""

import duckdb
import pytest

from data_analysis.catalog.lineage_tracker import LineageTracker, get_lineage_tracker
from data_analysis.catalog.meta_registry import (
    ColumnMeta,
    MetaRegistry,
    TableAsset,
    get_meta_registry,
)
from data_analysis.catalog.metadata_db import MetadataDB
from data_analysis.catalog.semantic_store import (
    EntityRef,
    MetricDefinition,
    SemanticMetricStore,
    SemanticModel,
    get_semantic_store,
)
from data_analysis.ontology.action_type import ActionParameter, ActionType
from data_analysis.ontology.link_type import LinkType
from data_analysis.ontology.object_type import ObjectType, PropertyMeta
from data_analysis.ontology.ontology_engine import (
    OntologyEngine,
    build_object_type_from_asset,
    get_ontology_engine,
)
from data_analysis.retl.webhook_pusher import WebhookPusher


@pytest.fixture
def con():
    db = duckdb.connect(":memory:")
    db.execute("""
    CREATE TABLE dim_store (
        store_id VARCHAR, city VARCHAR, revenue DOUBLE
    );
    INSERT INTO dim_store VALUES
    ('ST1', 'Shanghai', 10),
    ('ST2', 'Beijing', 30),
    ('ST3', 'Shenzhen', 5);

    CREATE TABLE dim_staff (
        staff_id VARCHAR, store_id VARCHAR, name VARCHAR
    );
    INSERT INTO dim_staff VALUES
    ('E1', 'ST1', 'Ann'),
    ('E2', 'ST1', 'Bo'),
    ('E3', 'ST2', 'Cy');

    CREATE TABLE staff_store (
        staff_id VARCHAR, store_id VARCHAR
    );
    INSERT INTO staff_store VALUES
    ('E1', 'ST1'), ('E1', 'ST1'), ('E2', 'ST1'), ('E3', 'ST2');

    CREATE TABLE people (
        employee_id VARCHAR, manager_id VARCHAR
    );
    INSERT INTO people VALUES
    ('E1', NULL), ('E2', 'E1'), ('E3', 'E2');

    CREATE TABLE cycle_a (id VARCHAR);
    INSERT INTO cycle_a VALUES ('A1');
    CREATE TABLE cycle_b (id VARCHAR, a_id VARCHAR);
    INSERT INTO cycle_b VALUES ('B1', 'A1');
    """)
    return db


@pytest.fixture
def engine():
    return get_ontology_engine()


def _asset():
    return TableAsset(
        dataset_name="dim_store",
        display_name="门店",
        description="store dimension",
        columns=[
            ColumnMeta(
                name="store_id",
                data_type="VARCHAR",
                semantic_type="IDENTIFIER",
                is_primary_key=True,
            ),
            ColumnMeta(name="city", data_type="VARCHAR", semantic_type="DIMENSION"),
            ColumnMeta(name="revenue", data_type="DOUBLE", semantic_type="MEASURE"),
        ],
        tags=["retail"],
    )


def test_catalog_asset_models_graph_and_drilldown(con, engine):
    ambiguous = TableAsset(
        dataset_name="dim_store",
        columns=[
            ColumnMeta(name="store_id", data_type="VARCHAR", semantic_type="IDENTIFIER"),
            ColumnMeta(name="city_id", data_type="VARCHAR", semantic_type="IDENTIFIER"),
        ],
    )
    with pytest.raises(ValueError, match="primary key"):
        build_object_type_from_asset(ambiguous)

    store = engine.register_from_catalog_asset(_asset(), name="SliceStore")
    assert store.primary_key == "store_id"
    assert store.backed_by_table == "dim_store"
    engine.register_object_type(
        ObjectType(
            name="SliceStaff",
            primary_key="staff_id",
            backed_by_table="dim_staff",
            properties=[
                PropertyMeta(name="staff_id", data_type="string", is_primary_key=True),
                PropertyMeta(name="store_id", data_type="string"),
                PropertyMeta(name="label", data_type="string", formula="name || ' @ ' || store_id"),
            ],
        )
    )
    with pytest.raises(ValueError, match="not a registered"):
        engine.register_link_type(
            LinkType(
                name="slice_missing_end",
                source_object_type="SliceStore",
                target_object_type="NoSuchType",
                source_join_key="store_id",
                target_join_key="store_id",
            )
        )
    with pytest.raises(ValueError, match="MANY_TO_MANY"):
        engine.register_link_type(
            LinkType(
                name="slice_staff_stores_bad",
                source_object_type="SliceStaff",
                target_object_type="SliceStore",
                cardinality="MANY_TO_MANY",
                source_join_key="staff_id",
                target_join_key="store_id",
            )
        )
    link = engine.register_link_type(
        LinkType(
            name="slice_staff_stores",
            source_object_type="SliceStaff",
            target_object_type="SliceStore",
            cardinality="many_to_many",
            source_join_key="staff_id",
            target_join_key="store_id",
            junction_table="staff_store",
            junction_source_key="staff_id",
            junction_target_key="store_id",
        )
    )
    assert link.cardinality == "MANY_TO_MANY"
    assert [item.name for item in engine.links_from("SliceStaff")] == ["slice_staff_stores"]

    graph = engine.entity_graph()
    edge = next(item for item in graph["edges"] if item["id"] == "slice_staff_stores")
    assert edge["source"] == "SliceStaff" and edge["target"] == "SliceStore"
    node = next(item for item in graph["nodes"] if item["id"] == "SliceStore")
    assert "slice_staff_stores" in node["incoming"]

    listed = engine.query_object_instances(con, "SliceStore", limit=2)
    assert listed["total_instances"] == 2
    assert listed["matched_count"] == 3
    vip = engine.query_object_instances(
        con, "SliceStore", filters="revenue > 5", properties=["store_id", "city"]
    )
    assert sorted(row["store_id"] for row in vip["instances"]) == ["ST1", "ST2"]
    with pytest.raises(ValueError, match="no property"):
        engine.query_object_instances(con, "SliceStore", properties=["not_a_column"])

    staff = engine.query_object_instances(con, "SliceStaff", properties=["staff_id", "label"])
    assert (
        next(row for row in staff["instances"] if row["staff_id"] == "E1")["label"] == "Ann @ ST1"
    )

    drilled = engine.traverse_links(con, "SliceStaff", "E1", "slice_staff_stores")
    assert drilled["linked_count"] == 1
    assert drilled["linked_instances"][0]["store_id"] == "ST1"
    assert drilled["truncated"] is False
    assert drilled["hop_details"][0]["instance_ids"] == ["ST1"]

    wide = engine.traverse_links(con, "SliceStaff", "E1", "slice_staff_stores", limit=1)
    assert wide["truncated"] is False
    crowded = engine.register_link_type(
        LinkType(
            name="slice_store_staff",
            source_object_type="SliceStore",
            target_object_type="SliceStaff",
            cardinality="ONE_TO_MANY",
            source_join_key="store_id",
            target_join_key="store_id",
        )
    )
    page = engine.traverse_links(con, "SliceStore", "ST1", crowded.name, limit=1)
    assert page["truncated"] is True
    assert page["linked_count"] == 1
    assert page["hop_details"][0]["instance_ids"] == ["E1"]


def test_reflexive_hop_and_type_cycle(con, engine):
    engine.register_object_type(
        ObjectType(name="SlicePerson", primary_key="employee_id", backed_by_table="people")
    )
    engine.register_link_type(
        LinkType(
            name="slice_reports_to",
            source_object_type="SlicePerson",
            target_object_type="SlicePerson",
            cardinality="MANY_TO_ONE",
            source_join_key="manager_id",
            target_join_key="employee_id",
        )
    )
    one = engine.traverse_links(con, "SlicePerson", "E3", "slice_reports_to")
    assert [row["employee_id"] for row in one["linked_instances"]] == ["E2"]
    two = engine.traverse_links(
        con,
        "SlicePerson",
        "E3",
        "slice_reports_to",
        link_path=["slice_reports_to", "slice_reports_to"],
    )
    assert two["hops"] == 2
    assert two["path"] == ["SlicePerson", "SlicePerson", "SlicePerson"]
    assert [row["employee_id"] for row in two["linked_instances"]] == ["E1"]

    engine.register_object_type(
        ObjectType(name="SliceA", primary_key="id", backed_by_table="cycle_a")
    )
    engine.register_object_type(
        ObjectType(name="SliceB", primary_key="id", backed_by_table="cycle_b")
    )
    engine.register_link_type(
        LinkType(
            name="slice_a_to_b",
            source_object_type="SliceA",
            target_object_type="SliceB",
            source_join_key="id",
            target_join_key="a_id",
        )
    )
    engine.register_link_type(
        LinkType(
            name="slice_b_to_a",
            source_object_type="SliceB",
            target_object_type="SliceA",
            source_join_key="a_id",
            target_join_key="id",
        )
    )
    with pytest.raises(ValueError, match="must start with link_name"):
        engine.traverse_links(
            con,
            "SliceA",
            "A1",
            "slice_a_to_b",
            link_path=["slice_b_to_a"],
        )
    with pytest.raises(ValueError, match="Cycle detected"):
        engine.traverse_links(
            con,
            "SliceA",
            "A1",
            "slice_a_to_b",
            link_path=["slice_a_to_b", "slice_b_to_a"],
        )
    stopped = engine.traverse_links(
        con,
        "SliceA",
        "missing",
        "slice_a_to_b",
        link_path=["slice_a_to_b", "slice_b_to_a"],
    )
    assert stopped["link_name"] == "slice_a_to_b"
    assert stopped["requested_hops"] == 2
    assert stopped["hops"] == 1
    assert stopped["linked_count"] == 0


def test_dangling_restored_link_is_a_value_error(con, engine):
    engine.register_object_type(
        ObjectType(name="SliceSrc", primary_key="store_id", backed_by_table="dim_store")
    )
    engine._link_types["slice_dangling"] = LinkType(
        name="slice_dangling",
        source_object_type="SliceSrc",
        target_object_type="SliceMissingTarget",
        source_join_key="store_id",
        target_join_key="store_id",
    )
    broken = engine.entity_graph()["broken_edges"]
    assert any(edge["id"] == "slice_dangling" for edge in broken)
    with pytest.raises(ValueError, match="SliceMissingTarget"):
        engine.traverse_links(con, "SliceSrc", "ST1", "slice_dangling")
    engine._link_types.pop("slice_dangling", None)


def test_unregister_refuses_live_edges_then_drops(engine):
    engine.register_object_type(
        ObjectType(name="SliceDrop", primary_key="store_id", backed_by_table="dim_store")
    )
    engine.register_object_type(
        ObjectType(name="SliceDropChild", primary_key="staff_id", backed_by_table="dim_staff")
    )
    engine.register_link_type(
        LinkType(
            name="slice_drop_link",
            source_object_type="SliceDrop",
            target_object_type="SliceDropChild",
            source_join_key="store_id",
            target_join_key="store_id",
        )
    )
    with pytest.raises(ValueError, match="still referenced"):
        engine.unregister_object_type("SliceDrop")
    assert engine.unregister_link_type("slice_drop_link") is True
    assert engine.unregister_link_type("slice_drop_link") is False
    assert engine.unregister_object_type("SliceDrop") is True
    assert engine.unregister_object_type("SliceDropChild") is True
    assert engine.get_object_type("SliceDrop") is None
    saved = {row["name"] for row in engine.db.list_ontology_objects()}
    assert "SliceDrop" not in saved


def test_action_failures_are_audited_and_do_not_mutate_caller(con, engine, monkeypatch):
    engine.register_object_type(
        ObjectType(name="SliceActor", primary_key="store_id", backed_by_table="dim_store")
    )
    with pytest.raises(ValueError, match="handler_type"):
        engine.register_action_type(
            ActionType(
                name="SliceBadHandler",
                target_object_type="SliceActor",
                handler_type="EMAIL",
            )
        )
    with pytest.raises(ValueError, match="sql_template"):
        engine.register_action_type(
            ActionType(
                name="SliceEmptySql",
                target_object_type="SliceActor",
                handler_type="SQL_MUTATION",
                handler_config={},
            )
        )
    with pytest.raises(ValueError, match="both"):
        engine.register_action_type(
            ActionType(
                name="SliceBothSql",
                target_object_type="SliceActor",
                handler_type="SQL_MUTATION",
                handler_config={"writeback_table": "wb", "sql_template": "SELECT 1"},
            )
        )

    engine._action_types["SliceRestoredEmpty"] = ActionType(
        name="SliceRestoredEmpty",
        target_object_type="SliceActor",
        handler_type="SQL_MUTATION",
        handler_config={},
    )
    empty = engine.execute_action(con, "SliceRestoredEmpty", "ST1", {})
    assert empty["status"] == "FAILED"
    assert empty["execution_result"]["status"] == "FAILED"

    typed = engine.register_action_type(
        ActionType(
            name="SliceTyped",
            target_object_type="SliceActor",
            handler_type="sql_mutation",
            parameters=[
                ActionParameter(name="new_city", data_type="string", required=True),
                ActionParameter(
                    name="reason", data_type="string", required=False, default_value="slice"
                ),
            ],
            handler_config={
                "sql_template": "UPDATE dim_store SET city = '{new_city}' WHERE store_id = '{instance_id}'"
            },
        )
    )
    assert typed.handler_type == "SQL_MUTATION"
    caller = {"new_city": 12}
    with pytest.raises(ValueError, match="expects string"):
        engine.execute_action(con, "SliceTyped", "ST1", caller)
    assert caller == {"new_city": 12}

    caller = {"new_city": "Hangzhou"}
    done = engine.execute_action(con, "SliceTyped", "ST1", caller)
    assert caller == {"new_city": "Hangzhou"}
    assert done["parameters"]["reason"] == "slice"
    assert done["status"] == "SUCCESS"
    assert (
        con.execute("SELECT city FROM dim_store WHERE store_id = 'ST1'").fetchone()[0] == "Hangzhou"
    )

    engine.register_action_type(
        ActionType(
            name="SliceBadTable",
            target_object_type="SliceActor",
            handler_type="SQL_MUTATION",
            parameters=[ActionParameter(name="new_city", data_type="string")],
            handler_config={
                "sql_template": "UPDATE slice_missing_table SET city = '{new_city}' WHERE store_id = '{instance_id}'"
            },
        )
    )
    failed = engine.execute_action(con, "SliceBadTable", "ST1", {"new_city": "X"})
    assert failed["status"] == "FAILED"
    assert "slice_missing_table" in failed["execution_result"]["message"]

    monkeypatch.setattr(
        WebhookPusher,
        "send_alert",
        lambda *_args, **_kwargs: {
            "status": "FAILED",
            "simulated_payload": {"kept": True},
            "error": "down",
        },
    )
    engine.register_action_type(
        ActionType(
            name="SliceHook",
            target_object_type="SliceActor",
            handler_type="WEBHOOK",
            handler_config={"webhook_url": "http://127.0.0.1:9/hook"},
        )
    )
    hooked = engine.execute_action(con, "SliceHook", "ST1", {})
    assert hooked["status"] == "FAILED"
    assert hooked["execution_result"]["simulated_payload"]["kept"] is True

    engine.register_object_type(
        ObjectType(name="SliceGhost", primary_key="id", backed_by_table="slice_no_such_table")
    )
    with pytest.raises(ValueError, match="slice_no_such_table"):
        engine.query_object_instances(con, "SliceGhost")


def test_catalog_delete_keyword_and_singleton_identity(tmp_path):
    memory = MetaRegistry(persistent=False)
    memory.register_table(TableAsset(dataset_name="alpha", display_name="华北仓"))
    assert any(row.dataset_name == "alpha" for row in memory.list_tables(keyword="华北"))
    assert memory.delete_table("alpha") is True
    assert memory.get_table("alpha") is None
    assert memory.delete_table("alpha") is False

    db = MetadataDB(db_path=str(tmp_path / "catalog.db"))
    durable = MetaRegistry(persistent=True)
    durable.db = db
    durable.register_table(TableAsset(dataset_name="gone_soon", display_name="将删除"))
    assert durable.get_table("gone_soon") is not None
    assert durable.delete_table("gone_soon") is True
    assert durable.get_table("gone_soon") is None
    assert durable.delete_table("gone_soon") is False

    assert MetaRegistry.get_instance() is get_meta_registry("_global")
    assert SemanticMetricStore.get_instance() is get_semantic_store("_global")
    assert LineageTracker.get_instance() is get_lineage_tracker("_global")


def test_metric_filters_and_model_lineage_roundtrip(tmp_path):
    store = SemanticMetricStore(persistent=False)
    store.register_metric(
        MetricDefinition(
            name="slice_sales",
            table_name="slice_sales_tbl",
            formula="SUM(sales)",
            aggregation_type="SUM",
            filter_expr="region = 'East'",
        )
    )
    store.register_metric(
        MetricDefinition(
            name="slice_profit",
            table_name="slice_sales_tbl",
            formula="SUM(profit)",
            aggregation_type="SUM",
            filter_expr="sales > 0",
        )
    )
    sql = store.compile_query(["slice_sales", "slice_profit"])
    assert "region = 'East'" in sql
    assert "sales > 0" in sql

    con = duckdb.connect(":memory:")
    con.execute("CREATE TABLE slice_sales_tbl (region VARCHAR, sales DOUBLE, profit DOUBLE)")
    con.execute("INSERT INTO slice_sales_tbl VALUES ('East', 10, 4), ('West', 99, 1)")
    assert con.execute(sql).fetchone()[0] == 10

    store.register_model(
        SemanticModel(
            name="slice_sales_model",
            table_name="slice_sales_tbl",
            grain=["region"],
            columns=["region", "sales", "profit"],
            entities=[EntityRef(name="region", type="primary", expr="region")],
        )
    )
    governed = store.compile_governed(["slice_sales"])
    assert "region = 'East'" in governed
    assert con.execute(governed).fetchone()[0] == 10

    con.execute("CREATE TABLE slice_cum (order_date DATE, amount DOUBLE, region VARCHAR)")
    con.execute("""
    INSERT INTO slice_cum VALUES
    (DATE '2024-01-01', 10, 'East'),
    (DATE '2024-01-02', 5, 'West'),
    (DATE '2024-01-03', 7, 'East')
    """)
    store.register_model(
        SemanticModel(
            name="slice_cum_model",
            table_name="slice_cum",
            grain=["order_date"],
            columns=["order_date", "amount", "region"],
            agg_time_dimension="order_date",
        )
    )
    store.register_metric(
        MetricDefinition(
            name="slice_running",
            table_name="slice_cum",
            formula="SUM(amount)",
            aggregation_type="CUMULATIVE",
            filter_expr="region = 'East'",
        )
    )
    spine = {
        str(day): value
        for day, value in con.execute(store.compile_governed(["slice_running"])).fetchall()
    }
    assert spine["2024-01-01"] == 10
    assert spine["2024-01-02"] == 10
    assert spine["2024-01-03"] == 17

    db = MetadataDB(db_path=str(tmp_path / "semantic.db"))
    saved = SemanticMetricStore(persistent=True, db=db)
    saved.register_model(
        SemanticModel(
            name="persisted_model",
            table_name="persisted_tbl",
            grain=["id"],
            columns=["id", "region"],
            entities=[EntityRef(name="id", type="primary", expr="id")],
            agg_time_dimension=None,
        )
    )
    reloaded = SemanticMetricStore(persistent=True, db=db)
    model = next(item for item in reloaded.list_models() if item.name == "persisted_model")
    assert model.table_name == "persisted_tbl"
    assert model.entities[0].expr == "id"

    lineage_db = MetadataDB(db_path=str(tmp_path / "lineage.db"))
    origin = LineageTracker(db=lineage_db)
    origin.record_dependency("slice_src", "slice_mart")
    origin.parse_and_record_sql_lineage(
        "slice_mart_2",
        "WITH c AS (SELECT * FROM slice_src) SELECT * FROM c JOIN slice_dim d ON c.id = d.id",
    )
    again = LineageTracker(db=lineage_db)
    nodes = {node["id"] for node in again.get_lineage_graph()["nodes"]}
    assert {"slice_src", "slice_mart", "slice_dim", "slice_mart_2"} <= nodes
    assert "c" not in nodes
    impact = again.get_impact_analysis("slice_src")
    assert "slice_mart" in impact["affected_tables"]
    assert "slice_mart_2" in impact["affected_tables"]
    private = LineageTracker()
    assert private.get_lineage_graph()["nodes"] == []


def test_engine_singleton_is_shared():
    assert get_ontology_engine() is OntologyEngine.get_instance()
