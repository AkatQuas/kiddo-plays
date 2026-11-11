# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any

from parsel import Selector

from agent_websearch.parsers.base import first_attr, first_text


def parse_amazon_product(html: str, asin: str | None = None) -> dict[str, Any]:
    """
    Parse a product detail HTML document into a structured dict.

    Expects common retail detail markup (title, price, bullets, images).
    Does not fetch pages; callers supply HTML.
    """
    sel = Selector(text=html)

    title = first_text(
        sel,
        '//*[@id="productTitle"]/text()',
        '//h1[@data-testid="product-title"]/text()',
        '//h1[contains(@class,"product-title")]/text()',
        "//h1/text()",
    )

    price = first_text(
        sel,
        '//*[@id="priceblock_ourprice"]/text()',
        '//*[@id="priceblock_dealprice"]/text()',
        '//span[contains(@class,"a-price")]/span[@class="a-offscreen"]/text()',
        '//*[@data-testid="price"]/text()',
        '//span[@itemprop="price"]/text()',
    )

    rating = first_text(
        sel,
        '//span[@data-hook="rating-out-of-text"]/text()',
        '//*[@id="acrPopover"]/@title',
        '//span[@itemprop="ratingValue"]/text()',
    )

    review_count = first_text(
        sel,
        '//*[@id="acrCustomerReviewText"]/text()',
        '//span[@data-hook="total-review-count"]/text()',
        '//span[@itemprop="reviewCount"]/text()',
    )

    availability = first_text(
        sel,
        '//*[@id="availability"]//text()',
        '//*[@data-testid="availability"]//text()',
    )

    brand = first_text(
        sel,
        '//*[@id="bylineInfo"]/text()',
        '//a[@id="bylineInfo"]/text()',
        '//*[@itemprop="brand"]//text()',
    )

    description = first_text(
        sel,
        '//*[@id="productDescription"]//text()',
        '//*[@data-testid="product-description"]//text()',
        '//div[@id="feature-bullets"]//li//text()',
    )

    bullets = [
        " ".join(t.strip() for t in node.xpath(".//text()").getall() if t.strip())
        for node in sel.xpath('//*[@id="feature-bullets"]//li')
    ]
    bullets = [b for b in bullets if b]

    images: list[str] = []
    for src in sel.xpath(
        '//*[@id="imgTagWrapperId"]//img/@src'
        ' | //*[@id="landingImage"]/@src'
        ' | //img[@data-testid="product-image"]/@src'
        ' | //div[contains(@class,"image")]//img/@src'
    ).getall():
        if src and src not in images:
            images.append(src)

    resolved_asin = asin or first_attr(
        sel,
        '//*[@name="ASIN"]/@value | //*[@data-asin]/@data-asin | //@data-asin',
    )

    return {
        "asin": resolved_asin or None,
        "title": title or None,
        "price": price or None,
        "rating": rating or None,
        "review_count": review_count or None,
        "availability": " ".join(availability.split()) if availability else None,
        "brand": brand or None,
        "description": " ".join(description.split()) if description else None,
        "feature_bullets": bullets,
        "images": images,
    }
