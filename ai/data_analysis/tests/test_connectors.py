import duckdb

from data_analysis.connectors.factory import ConnectorFactory


def test_local_connector_parquet(tmp_path):
    p = tmp_path / "test.parquet"
    con = duckdb.connect(":memory:")
    con.execute("CREATE TABLE sample (id INT, city VARCHAR, sales DOUBLE)")
    con.execute(
        "INSERT INTO sample VALUES (1, 'Beijing', 100.5), (2, 'Shanghai', 200.0), (3, 'Guangzhou', 150.2)"
    )
    con.execute(f"COPY sample TO '{p}' (FORMAT PARQUET)")
    con.close()

    conn = ConnectorFactory.get_connector(f"file://{p}")
    assert conn.test_connection() is True
    schema = conn.introspect_schema("sample")
    assert len(schema.columns) == 3

    arrow_tbl = conn.fetch_to_arrow("sample", select_cols=["city", "sales"])
    assert len(arrow_tbl) == 3
    assert arrow_tbl.column_names == ["city", "sales"]
