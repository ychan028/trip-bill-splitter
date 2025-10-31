"""Data models for property listings."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class PropertyType(str, Enum):
    """Property types we're tracking."""
    OFFICE = "office"
    RETAIL = "retail"
    INDUSTRIAL = "industrial"
    MEDICAL = "medical"


class PropertyListing(BaseModel):
    """Structured data for a commercial property listing."""

    site_name: str = Field(
        ...,
        description="Property name and location, e.g. 'Innovation Office Park, Irvine, CA 92618'"
    )
    site_size: str = Field(
        ...,
        description="Available space size, e.g. '2,094 - 214,283 SF of Office Space Available'"
    )
    addresses: list[str] = Field(
        default_factory=list,
        description="List of street addresses at this property"
    )
    property_type: PropertyType = Field(
        ...,
        description="Type of commercial property"
    )
    listing_url: HttpUrl = Field(
        ...,
        description="Source URL of the listing"
    )
    scraped_at: datetime = Field(
        default_factory=datetime.now,
        description="When this data was scraped"
    )
    raw_html: Optional[str] = Field(
        None,
        description="Raw HTML for debugging (optional)"
    )

    class Config:
        """Pydantic config."""
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            HttpUrl: str
        }
