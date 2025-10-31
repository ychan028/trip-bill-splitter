#!/usr/bin/env python3
"""Demo script for testing the property scraper and parser."""
import json
import os
from pathlib import Path
from dotenv import load_dotenv

from src.scraper import PropertyScraper
from src.parser import AnthropicPropertyParser


def save_results(listings, output_file: str = "data/results.json"):
    """Save parsed listings to a JSON file."""
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = [listing.model_dump(mode='json') for listing in listings]

    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\n✓ Saved {len(listings)} listings to {output_file}")


def demo_single_url(url: str):
    """Test scraping and parsing a single URL."""
    print(f"\n{'='*60}")
    print(f"DEMO: Single URL Test")
    print(f"{'='*60}\n")

    # Initialize components
    scraper = PropertyScraper(rate_limit_seconds=1.0)
    parser = AnthropicPropertyParser()

    # Fetch the page
    print(f"Fetching: {url}")
    html = scraper.fetch_page(url)

    if not html:
        print("Failed to fetch page!")
        return

    print(f"✓ Fetched {len(html)} characters of HTML")

    # Get clean text for Claude
    text = scraper.get_text_content(html)
    print(f"✓ Extracted {len(text)} characters of text")

    # Parse with Claude
    print("\nParsing with Claude...")
    listing = parser.parse_property_listing(text, url, save_raw_html=False)

    if listing:
        print(f"\n{'='*60}")
        print("EXTRACTED DATA:")
        print(f"{'='*60}")
        print(f"Site Name: {listing.site_name}")
        print(f"Site Size: {listing.site_size}")
        print(f"Property Type: {listing.property_type}")
        print(f"Addresses: {', '.join(listing.addresses) if listing.addresses else 'None'}")
        print(f"URL: {listing.listing_url}")
        print(f"Scraped At: {listing.scraped_at}")

        # Save to file
        save_results([listing], "data/single_test.json")
    else:
        print("\n✗ Failed to parse listing")


def demo_batch_urls(urls: list[str], batch_size: int = 5):
    """Test scraping and parsing multiple URLs."""
    print(f"\n{'='*60}")
    print(f"DEMO: Batch Test ({len(urls)} URLs)")
    print(f"{'='*60}\n")

    # Limit to batch size
    urls = urls[:batch_size]

    # Initialize components
    scraper = PropertyScraper(rate_limit_seconds=2.0)
    parser = AnthropicPropertyParser()

    # Fetch all pages
    print("Fetching pages...")
    pages = []
    for i, url in enumerate(urls, 1):
        print(f"  [{i}/{len(urls)}] {url}")
        html = scraper.fetch_page(url)

        if html:
            text = scraper.get_text_content(html)
            pages.append((text, url))
            print(f"    ✓ Fetched {len(text)} characters")
        else:
            print(f"    ✗ Failed")

    # Parse all pages
    print(f"\nParsing {len(pages)} pages with Claude...")
    listings = parser.parse_batch(pages, save_raw_html=False)

    # Display results
    print(f"\n{'='*60}")
    print(f"RESULTS: {len(listings)}/{len(urls)} successful")
    print(f"{'='*60}\n")

    for listing in listings:
        print(f"✓ {listing.site_name}")
        print(f"  Type: {listing.property_type} | Size: {listing.site_size}")
        print()

    if listings:
        save_results(listings, "data/batch_test.json")


def main():
    """Main demo entry point."""
    # Load environment variables
    load_dotenv()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not found!")
        print("Please create a .env file with your API key:")
        print("  ANTHROPIC_API_KEY=your_key_here")
        return

    print("Illinois Commercial Real Estate Scraper - Demo")
    print("=" * 60)

    # Example usage - replace with actual LoopNet URLs
    sample_urls = [
        # "https://www.loopnet.com/Listing/123-Main-St/...",
        # "https://www.loopnet.com/Listing/456-Oak-Ave/...",
    ]

    if not sample_urls:
        print("\nNo sample URLs provided!")
        print("\nTo test, add LoopNet listing URLs to the 'sample_urls' list in demo.py")
        print("or create a data/test_urls.txt file with one URL per line.")
        print("\nExample URL format:")
        print("  https://www.loopnet.com/Listing/...")

        # Try to load from file
        url_file = Path("data/test_urls.txt")
        if url_file.exists():
            with open(url_file) as f:
                sample_urls = [line.strip() for line in f if line.strip()]
            print(f"\n✓ Loaded {len(sample_urls)} URLs from {url_file}")

    if not sample_urls:
        print("\nCreate data/test_urls.txt with URLs to test, one per line.")
        return

    # Ask user which demo to run
    print("\nSelect demo mode:")
    print("1. Single URL test (first URL)")
    print("2. Batch test (up to 5 URLs)")
    choice = input("\nEnter choice (1 or 2): ").strip()

    if choice == "1":
        demo_single_url(sample_urls[0])
    elif choice == "2":
        demo_batch_urls(sample_urls, batch_size=5)
    else:
        print("Invalid choice!")


if __name__ == "__main__":
    main()
