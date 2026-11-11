# -*- coding: utf-8 -*-
from pathlib import Path

from agent_websearch.parsers import parse_amazon_list, parse_amazon_product

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_amazon_product():
    html = (FIXTURES / "amazon_product.html").read_text(encoding="utf-8")
    result = parse_amazon_product(html)
    assert result["asin"] == "B0EXAMPLE01"
    assert "Headphones" in (result["title"] or "")
    assert result["price"] == "$129.99"
    assert result["brand"] and "Acme" in result["brand"]
    assert len(result["feature_bullets"]) == 3
    assert result["images"]
    assert result["availability"] and "Stock" in result["availability"]


def test_parse_amazon_list():
    html = (FIXTURES / "amazon_list.html").read_text(encoding="utf-8")
    result = parse_amazon_list(html, url="https://example.com/s?k=headphones")
    assert result["count"] == 2
    assert result["items"][0]["asin"] == "B0EXAMPLE01"
    assert result["items"][1]["asin"] == "B0EXAMPLE02"
    assert result["items"][0]["price"] == "$129.99"
