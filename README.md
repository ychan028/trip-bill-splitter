# Illinois Commercial Real Estate Scraper

A tool to scrape commercial real estate listings (office, retail, industrial, medical) from Illinois using LoopNet or similar sites, with AI-powered parsing via Anthropic's Claude API.

## Features

- 🏢 **Scrape commercial property listings** from LoopNet
- 🤖 **AI-powered parsing** using Claude to extract structured data
- 📊 **Structured output** with property name, size, addresses, and type
- 🔄 **Batch processing** with configurable batch sizes for testing
- ⚡ **Rate limiting** to be respectful of source websites
- 💾 **Export to JSON** for further analysis

## Project Structure

```
powertown-site-locator/
├── src/
│   ├── models.py      # Data models (PropertyListing, PropertyType)
│   ├── scraper.py     # Web scraping logic
│   └── parser.py      # Anthropic API integration
├── data/
│   └── test_urls.txt  # Your test URLs
├── demo.py            # Demo script to test the tool
├── requirements.txt   # Python dependencies
└── .env              # Your API keys (create this)
```

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Install Playwright (for JavaScript-heavy pages)

```bash
playwright install chromium
```

### 3. Configure API Key

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

### 4. Add Test URLs

Edit `data/test_urls.txt` and add LoopNet listing URLs, one per line:

```
https://www.loopnet.com/Listing/123-Main-St-Chicago-IL/12345678/
https://www.loopnet.com/Listing/456-Oak-Ave-Springfield-IL/87654321/
```

## Usage

### Quick Start

Run the demo script:

```bash
python demo.py
```

Choose:
- **Option 1**: Test a single URL (good for initial testing)
- **Option 2**: Test a batch of up to 5 URLs

### Results

Results are saved to:
- `data/single_test.json` - Single URL test results
- `data/batch_test.json` - Batch test results

### Example Output

```json
{
  "site_name": "Innovation Office Park, Chicago, IL 60601",
  "site_size": "2,094 - 214,283 SF of Office Space Available",
  "addresses": ["250 Progress Ave", "260 Progress Ave"],
  "property_type": "office",
  "listing_url": "https://www.loopnet.com/...",
  "scraped_at": "2024-01-15T10:30:00"
}
```

## How It Works

1. **Scraper** (`src/scraper.py`):
   - Fetches HTML from LoopNet URLs
   - Rate-limited to be polite
   - Extracts clean text content

2. **Parser** (`src/parser.py`):
   - Sends content to Claude API
   - Extracts structured data using AI
   - Returns validated PropertyListing objects

3. **Models** (`src/models.py`):
   - Pydantic data models for validation
   - Ensures data quality and type safety

## Testing Strategy

### Phase 1: Single URL (Start Here)
```bash
python demo.py  # Choose option 1
```
- Test with 1-2 URLs to verify parsing accuracy
- Check if Claude extracts data correctly
- Adjust prompts if needed

### Phase 2: Small Batch (5-10 URLs)
```bash
python demo.py  # Choose option 2
```
- Test rate limiting
- Verify consistency across multiple listings
- Monitor API costs

### Phase 3: Larger Batch (50-100 URLs)
- Modify `demo.py` batch_size parameter
- Run overnight for larger datasets
- Export to CSV for analysis

## API Costs

Claude API pricing (as of 2024):
- **Claude 3.5 Sonnet**: ~$3 per million input tokens
- Average property listing: ~5,000 tokens
- Cost per listing: ~$0.015 (1.5 cents)

**Example costs:**
- 10 listings: ~$0.15
- 100 listings: ~$1.50
- 1,000 listings: ~$15

## Important Notes

### Legal & Ethical
- ⚠️ Check LoopNet's Terms of Service before scraping
- ⚠️ Review robots.txt: https://www.loopnet.com/robots.txt
- Consider using official APIs if available
- Be respectful with rate limiting

### Technical Limitations
- Some listings may require authentication
- JavaScript-heavy pages may need Playwright
- API rate limits apply (use batching)

## Advanced Usage

### Use Playwright for JavaScript Pages

```python
from src.scraper import PropertyScraper

scraper = PropertyScraper()
html = scraper.fetch_page(url, use_playwright=True)
```

### Custom Batch Processing

```python
from src.scraper import PropertyScraper
from src.parser import AnthropicPropertyParser

scraper = PropertyScraper(rate_limit_seconds=3.0)
parser = AnthropicPropertyParser()

urls = ["url1", "url2", "url3"]
for url in urls:
    html = scraper.fetch_page(url)
    text = scraper.get_text_content(html)
    listing = parser.parse_property_listing(text, url)
    print(listing)
```

## Next Steps

1. ✅ Test with sample URLs
2. ✅ Verify parsing accuracy
3. ⏭️ Add database storage (SQLite/PostgreSQL)
4. ⏭️ Build search functionality for Illinois properties
5. ⏭️ Add CSV export
6. ⏭️ Create CLI tool with Click
7. ⏭️ Add retry logic and error recovery

## Troubleshooting

**"ANTHROPIC_API_KEY not found"**
- Create `.env` file with your API key

**"Failed to fetch page"**
- Check URL is valid
- Try with `use_playwright=True`
- Check your internet connection

**"Failed to parse listing"**
- Claude might need better prompts
- Check if page structure is unusual
- Review the raw HTML

## Contributing

Feel free to add features:
- More property sites (CoStar, Crexi, etc.)
- Better error handling
- Export formats (CSV, Excel)
- Database integration