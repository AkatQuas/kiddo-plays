# -*- coding: utf-8 -*-
from __future__ import annotations

from parsel import Selector


def first_text(selector: Selector, *xpaths: str) -> str:
    for xp in xpaths:
        values = selector.xpath(xp).getall()
        text = " ".join(v.strip() for v in values if v and v.strip())
        if text:
            return text
    return ""


def first_attr(selector: Selector, xpath: str) -> str:
    value = selector.xpath(xpath).get()
    return value.strip() if value else ""
