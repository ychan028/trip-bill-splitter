"""Anthropic-powered parser for extracting property data."""
import json
import os
from typing import Optional
from anthropic import Anthropic
from .models import PropertyListing, PropertyType


class AnthropicPropertyParser:
    """Uses Claude to extract structured property data from HTML/text."""

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        """
        Initialize the parser.

        Args:
            api_key: Anthropic API key (or reads from ANTHROPIC_API_KEY env var)
            model: Claude model to use
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment or provided")

        self.client = Anthropic(api_key=self.api_key)
        self.model = model

    def parse_property_listing(
        self,
        content: str,
        listing_url: str,
        save_raw_html: bool = False
    ) -> Optional[PropertyListing]:
        """
        Parse property listing content using Claude.

        Args:
            content: HTML or text content of the listing page
            listing_url: URL of the listing
            save_raw_html: Whether to save raw HTML in the result

        Returns:
            PropertyListing object or None if parsing failed
        """
        prompt = self._build_extraction_prompt(content)

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            # Extract JSON from response
            response_text = response.content[0].text
            json_data = self._extract_json(response_text)

            if not json_data:
                print(f"Failed to extract JSON from Claude response")
                return None

            # Add the listing URL
            json_data['listing_url'] = listing_url

            # Optionally save raw HTML
            if save_raw_html:
                json_data['raw_html'] = content

            # Create and validate the PropertyListing object
            listing = PropertyListing(**json_data)
            return listing

        except Exception as e:
            print(f"Error parsing with Claude: {e}")
            return None

    def _build_extraction_prompt(self, content: str) -> str:
        """Build the prompt for Claude to extract property data."""
        return f"""You are extracting structured data from a commercial real estate listing page.

Extract the following information from the page content below:

1. **site_name**: The property name and location (e.g., "Innovation Office Park, Irvine, CA 92618")
2. **site_size**: The available space size (e.g., "2,094 - 214,283 SF of Office Space Available")
3. **addresses**: List of street addresses at this property (as an array)
4. **property_type**: Must be one of: "office", "retail", "industrial", or "medical"

Return your response as a JSON object with these exact keys. If a field is not found, use reasonable defaults:
- For addresses: use empty array []
- For site_size: use "Size not specified"

Example output format:
{{
  "site_name": "Innovation Office Park, Irvine, CA 92618",
  "site_size": "2,094 - 214,283 SF",
  "addresses": ["250 Progress Ave", "260 Progress Ave"],
  "property_type": "office"
}}

Page content:
---
{content[:15000]}
---

Extract the property information as JSON:"""

    def _extract_json(self, text: str) -> Optional[dict]:
        """Extract JSON from Claude's response."""
        # Try to find JSON in the response
        try:
            # Look for JSON code block
            if "```json" in text:
                json_str = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                json_str = text.split("```")[1].split("```")[0].strip()
            else:
                json_str = text.strip()

            return json.loads(json_str)
        except (json.JSONDecodeError, IndexError) as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Response was: {text[:500]}")
            return None

    def parse_batch(
        self,
        listings: list[tuple[str, str]],
        save_raw_html: bool = False
    ) -> list[PropertyListing]:
        """
        Parse multiple listings.

        Args:
            listings: List of (content, url) tuples
            save_raw_html: Whether to save raw HTML

        Returns:
            List of successfully parsed PropertyListing objects
        """
        results = []

        for i, (content, url) in enumerate(listings, 1):
            print(f"Parsing listing {i}/{len(listings)}: {url}")

            listing = self.parse_property_listing(
                content,
                url,
                save_raw_html=save_raw_html
            )

            if listing:
                results.append(listing)
                print(f"  ✓ Successfully parsed: {listing.site_name}")
            else:
                print(f"  ✗ Failed to parse")

        print(f"\nParsed {len(results)}/{len(listings)} listings successfully")
        return results
