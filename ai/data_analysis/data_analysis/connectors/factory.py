from data_analysis.connectors.base import BaseConnector
from data_analysis.connectors.local import LocalFileConnector
from data_analysis.connectors.mssql import MSSQLConnector
from data_analysis.connectors.mysql import MySQLConnector
from data_analysis.connectors.postgres import PostgresConnector


class ConnectorFactory:
    """Factory to instantiate corresponding DB connector by connection URI."""

    _registry: dict[str, type[BaseConnector]] = {
        "postgresql": PostgresConnector,
        "postgres": PostgresConnector,
        "mysql": MySQLConnector,
        "mssql": MSSQLConnector,
        "sqlserver": MSSQLConnector,
        "sqlite": LocalFileConnector,
        "duckdb": LocalFileConnector,
        "file": LocalFileConnector,
    }

    @classmethod
    def get_connector(cls, conn_str: str) -> BaseConnector:
        if not isinstance(conn_str, str) or not conn_str.strip():
            raise ValueError("Connection string must be a non-empty string")
        text = conn_str.strip()
        if "://" not in text:
            return LocalFileConnector(text)
        prefix = text.split("://", 1)[0].lower()
        connector_cls = cls._registry.get(prefix)
        if connector_cls is None:
            known = ", ".join(sorted(cls._registry))
            raise ValueError(
                f"Unsupported connection scheme {prefix!r}. Supported schemes: {known}. "
                "Pass a local filesystem path without a scheme to read a file."
            )
        return connector_cls(text)
