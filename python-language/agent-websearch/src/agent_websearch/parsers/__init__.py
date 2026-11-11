"""Pure HTML parsers (no network I/O)."""

from agent_websearch.parsers.amazon_list import parse_amazon_list
from agent_websearch.parsers.amazon_product import parse_amazon_product

__all__ = ["parse_amazon_product", "parse_amazon_list"]
