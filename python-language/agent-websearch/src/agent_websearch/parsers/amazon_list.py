# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any

from parsel import Selector

from agent_websearch.parsers.base import first_attr, first_text


def parse_amazon_list(html: str, url: str | None = None) -> dict[str, Any]:
    """
    Parse a product search/list HTML document into structured items.

    Does not fetch pages; callers supply HTML.
    """
    sel = Selector(text=html)
    items: list[dict[str, Any]] = []

    cards = sel.xpath(
        '//div[@data-component-type="s-search-result"]'
        ' | //div[@data-testid="product-card"]'
        ' | //li[contains(@class,"product-item")]'
        ' | //article[contains(@class,"product")]'
    )

    for card in cards:
        asin = first_attr(card, "./@data-asin | ./@data-product-id")
        title = first_text(
            card,
            './/h2//span/text()',
            './/*[@data-testid="product-title"]//text()',
            './/h2/text()',
            './/a[contains(@class,"title")]//text()',
        )
        link = first_attr(
            card,
            './/h2/a/@href | .//a[@data-testid="product-link"]/@href | .//a[contains(@class,"title")]/@href',
        )
        price = first_text(
            card,
            './/span[contains(@class,"a-price")]/span[@class="a-offscreen"]/text()',
            './/*[@data-testid="price"]//text()',
            './/span[contains(@class,"price")]/text()',
        )
        rating = first_text(
            card,
            './/span[contains(@class,"a-icon-alt")]/text()',
            './/*[@data-testid="rating"]//text()',
        )
        image = first_attr(card, ".//img/@src | .//img/@data-src")

        if not title and not asin:
            continue
        items.append(
            {
                "asin": asin or None,
                "title": title or None,
                "link": link or None,
                "price": price or None,
                "rating": rating or None,
                "image": image or None,
            }
        )

    return {
        "url": url,
        "count": len(items),
        "items": items,
    }
