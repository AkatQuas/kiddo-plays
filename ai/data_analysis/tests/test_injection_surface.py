import duckdb
import pytest

from data_analysis.distributed_ops.dist_driver import DistributedDriverAnalysis
from data_analysis.distributed_ops.dist_eda import DistributedEDA
from data_analysis.distributed_ops.dist_olap import DistributedOLAP
from data_analysis.observability.assertions import DataQualityAssertions
from data_analysis.observability.schema_drift import SchemaDrifter
from data_analysis.ontology.link_type import LinkType
from data_analysis.ontology.object_type import ObjectType, PropertyMeta
from data_analysis.ontology.ontology_engine import OntologyEngine


@pytest.fixture
def con():
    c = duckdb.connect(":memory:")
    c.execute("""
        CREATE TABLE dim_customers (
            customer_id VARCHAR,
            tier VARCHAR,
            region VARCHAR,
            revenue DOUBLE,
            period VARCHAR
        )
    """)
    c.execute("""
        INSERT INTO dim_customers VALUES
            ('C01', 'gold', 'North', 100.0, 'base'),
            ('C02', 'silver', 'North', 200.0, 'base'),
            ('C03', 'gold', 'South', 300.0, 'curr'),
            ('C04', 'bronze', 'South', 400.0, 'curr')
    """)
    c.execute("""
        CREATE TABLE fact_orders (
            order_id VARCHAR,
            customer_id VARCHAR,
            amount DOUBLE
        )
    """)
    c.execute("""
        INSERT INTO fact_orders VALUES
            ('O1', 'C01', 10.0),
            ('O2', 'C01', 20.0),
            ('O3', 'C02', 30.0)
    """)
    return c


@pytest.fixture
def engine(con):
    eng = OntologyEngine.get_instance()
    eng.register_object_type(
        ObjectType(
            name="InjCustomer",
            primary_key="customer_id",
            backed_by_table="dim_customers",
            properties=[
                PropertyMeta(name="customer_id", data_type="VARCHAR"),
                PropertyMeta(name="tier", data_type="VARCHAR"),
            ],
        )
    )
    eng.register_object_type(
        ObjectType(
            name="InjOrder",
            primary_key="order_id",
            backed_by_table="fact_orders",
            properties=[PropertyMeta(name="order_id", data_type="VARCHAR")],
        )
    )
    eng.register_link_type(
        LinkType(
            name="inj_customer_orders",
            source_object_type="InjCustomer",
            target_object_type="InjOrder",
            source_join_key="customer_id",
            target_join_key="customer_id",
            cardinality="ONE_TO_MANY",
        )
    )
    return eng


def _table_exists(con, name):
    return (
        con.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = ?", [name]
        ).fetchone()[0]
        == 1
    )


def test_ontology_filter_statement_injection_blocked(con, engine):
    with pytest.raises(ValueError):
        engine.query_object_instances(con, "InjCustomer", filters="1=1; DROP TABLE dim_customers")
    assert _table_exists(con, "dim_customers")


def test_ontology_filter_comment_injection_blocked(con, engine):
    with pytest.raises(ValueError):
        engine.query_object_instances(con, "InjCustomer", filters="1=1 -- x")
    assert _table_exists(con, "dim_customers")


def test_traverse_links_quote_injection_returns_nothing(con, engine):
    res = engine.traverse_links(con, "InjCustomer", "C01' OR '1'='1", "inj_customer_orders")
    assert res["linked_count"] == 0
    assert res["linked_instances"] == []


def test_traverse_links_legitimate_still_works(con, engine):
    res = engine.traverse_links(con, "InjCustomer", "C01", "inj_customer_orders")
    assert res["linked_count"] == 2
    assert {r["order_id"] for r in res["linked_instances"]} == {"O1", "O2"}


def test_ontology_query_legitimate_still_works(con, engine):
    res = engine.query_object_instances(
        con, "InjCustomer", filters="tier = 'gold'", properties=["customer_id", "tier"]
    )
    assert res["total_instances"] == 2
    assert res["primary_key"] == "customer_id"
    assert all(set(r) == {"customer_id", "tier"} for r in res["instances"])


def test_ontology_query_limit_is_bound_parameter(con, engine):
    res = engine.query_object_instances(con, "InjCustomer", limit=2)
    assert res["total_instances"] == 2


def test_eda_dataset_name_injection_raises(con):
    with pytest.raises(ValueError):
        DistributedEDA.profile_table(con, "dim_customers; DROP TABLE dim_customers")
    assert _table_exists(con, "dim_customers")


def test_eda_legitimate_profile_unchanged(con):
    rep = DistributedEDA.profile_table(con, "dim_customers")
    assert rep["table_name"] == "dim_customers"
    assert rep["total_rows"] == 4
    assert "revenue" in rep["columns"]


def test_assertions_table_and_column_injection_raise(con):
    with pytest.raises(ValueError):
        DataQualityAssertions.expect_column_values_to_not_be_null(
            con, "dim_customers; DROP TABLE dim_customers", "tier"
        )
    with pytest.raises(ValueError):
        DataQualityAssertions.expect_column_values_to_be_unique(
            con, "dim_customers", 'tier" FROM dim_customers UNION SELECT 1 --'
        )
    assert _table_exists(con, "dim_customers")


def test_assertions_suite_legitimate_still_works(con):
    res = DataQualityAssertions.run_suite(
        con,
        "dim_customers",
        [
            {"type": "not_null", "column": "customer_id"},
            {"type": "unique", "column": "customer_id"},
            {"type": "between", "column": "revenue", "min_val": 0, "max_val": 1000},
            {"type": "row_count", "min_rows": 1, "max_rows": 10},
        ],
    )
    assert res["total_assertions"] == 4
    assert res["passed_assertions"] == 4
    assert res["all_passed"] is True
    assert res["data_health_score"] == 100.0


def test_assertions_between_detects_real_violation(con):
    res = DataQualityAssertions.expect_column_values_to_be_between(
        con, "dim_customers", "revenue", 0, 150
    )
    assert res["passed"] is False
    assert res["unexpected_count"] == 3


def test_schema_drift_table_injection_raises(con):
    with pytest.raises(ValueError):
        SchemaDrifter.detect_drift(
            con, "dim_customers; DROP TABLE dim_customers", {"customer_id": "VARCHAR"}
        )
    assert _table_exists(con, "dim_customers")


def test_schema_drift_legitimate_still_works(con):
    res = SchemaDrifter.detect_drift(
        con,
        "dim_customers",
        {
            "customer_id": "VARCHAR",
            "tier": "VARCHAR",
            "region": "VARCHAR",
            "revenue": "DOUBLE",
            "period": "VARCHAR",
        },
    )
    assert res["has_drift"] is False
    assert res["table_name"] == "dim_customers"


def test_olap_injection_raises(con):
    with pytest.raises(ValueError):
        DistributedOLAP.aggregate(
            con,
            "dim_customers",
            ["region"],
            ["revenue"],
            filters="1=1; DROP TABLE dim_customers",
        )
    with pytest.raises(ValueError):
        DistributedOLAP.aggregate(
            con,
            "dim_customers",
            ["region"],
            ["revenue"],
            agg_funcs=["SUM(1); DROP TABLE dim_customers"],
        )
    assert _table_exists(con, "dim_customers")


def test_olap_legitimate_aggregate_and_pivot(con):
    tbl = DistributedOLAP.aggregate(
        con, "dim_customers", ["region"], ["revenue"], filters="revenue > 50"
    ).to_pydict()
    assert set(tbl["region"]) == {"North", "South"}
    assert sum(tbl["revenue_sum"]) == 1000.0

    piv = DistributedOLAP.pivot_table(
        con, "dim_customers", ["region"], "tier", "revenue"
    ).to_pydict()
    assert "region" in piv
    assert "gold_sum" in piv


def test_driver_filter_injection_raises(con):
    with pytest.raises(ValueError):
        DistributedDriverAnalysis.analyze_driver(
            con,
            "dim_customers",
            "revenue",
            ["region"],
            base_filter="period = 'base'; DROP TABLE dim_customers",
            current_filter="period = 'curr'",
        )
    assert _table_exists(con, "dim_customers")


def test_driver_legitimate_attribution_still_works(con):
    res = DistributedDriverAnalysis.analyze_driver(
        con,
        "dim_customers",
        "revenue",
        ["region"],
        base_filter="period = 'base'",
        current_filter="period = 'curr'",
    )
    assert res["base_total"] == 300.0
    assert res["current_total"] == 700.0
    assert res["diff_total"] == 400.0
