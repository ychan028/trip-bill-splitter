#!/usr/bin/env python3
"""Quick test script - paste a URL and see the results."""
import os
from dotenv import load_dotenv
from src.scraper import PropertyScraper
from src.parser import AnthropicPropertyParser

# Load environment
load_dotenv()

def test_url(url: str):
    """Quick test of a single URL."""
    print(f"\nTesting: {url}\n")

    # Initialize
    scraper = PropertyScraper()
    parser = AnthropicPropertyParser()

    # Fetch
    print("Fetching page...")
    html = scraper.fetch_page(url)
    if not html:
        print("Failed to fetch!")
        return

    # Parse
    print("Extracting text...")
    text = scraper.get_text_content(html)
    print(f"Got {len(text)} characters")

    # Use Claude
    print("\nParsing with Claude...")
    listing = parser.parse_property_listing(text, url)

    # Results
    if listing:
        print("\n" + "="*60)
        print("SUCCESS!")
        print("="*60)
        print(f"\nName:      {listing.site_name}")
        print(f"Size:      {listing.site_size}")
        print(f"Type:      {listing.property_type}")
        print(f"Addresses: {listing.addresses}")
        print(f"URL:       {listing.listing_url}")
    else:
        print("\nFailed to parse listing")

if __name__ == "__main__":
    # Test with a URL
    test_url = input("Enter a LoopNet URL to test: ").strip()

    if test_url:
        test_url(test_url)
    else:
        print("No URL provided!")
