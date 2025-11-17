"""Pydantic models shared across the Crawl4AI app."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

PlaceCategory = Literal[
    "restaurant",
    "bar",
    "cafe",
    "hotel",
    "landmark",
    "attraction",
    "other",
]


class CrawlRequest(BaseModel):
    url: str = Field(..., description="Absolute or www-prefixed URL to crawl")


class PlaceExtractionSchema(BaseModel):
    """Schema used for Crawl4AI LLM extraction."""

    name: str = Field(..., description="Business or place name")
    address: str = Field(..., description="Full mailing address for the place")
    phone: Optional[str] = Field(
        None, description="Formatted phone number including country/area code"
    )
    website: Optional[str] = Field(None, description="Canonical website URL")
    category: PlaceCategory = Field(
        default="other",
        description="One of restaurant, bar, cafe, hotel, landmark, attraction, other",
    )


class PlaceResponse(BaseModel):
    name: str
    address: Optional[str] = None
    formatted_address: Optional[str] = Field(
        default=None,
        description="Alias compatible with PlaceDetailsResponse",
    )
    phone: Optional[str] = None
    website: Optional[str] = None
    category: Optional[PlaceCategory] = None
