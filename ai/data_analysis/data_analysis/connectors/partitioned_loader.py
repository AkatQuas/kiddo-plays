import pyarrow as pa

from data_analysis.connectors.factory import ConnectorFactory


class PartitionedLoader:
    """Loads massive datasets in parallel across partitions into an aggregated Arrow Table."""

    @staticmethod
    def load_parallel(
        conn_str: str,
        query_or_table: str,
        partition_col: str | None = None,
        num_partitions: int = 4,
        select_cols: list[str] | None = None,
        filter_sql: str | None = None,
        limit: int | None = None,
    ) -> pa.Table:
        connector = ConnectorFactory.get_connector(conn_str)
        return connector.fetch_to_arrow(
            query_or_table=query_or_table,
            filter_sql=filter_sql,
            select_cols=select_cols,
            partition_col=partition_col,
            num_partitions=num_partitions,
            limit=limit,
        )
