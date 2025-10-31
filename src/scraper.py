"""Web scraper for commercial real estate listings."""
import time
from typing import Optional
import requests
from bs4 import BeautifulSoup


class PropertyScraper:
    """Scraper for fetching property listing pages."""

    def __init__(self, rate_limit_seconds: float = 2.0):
        """
        Initialize the scraper.

        Args:
            rate_limit_seconds: Minimum seconds between requests (be polite!)
        """
        self.rate_limit_seconds = rate_limit_seconds
        self.last_request_time = 0
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def _rate_limit(self):
        """Enforce rate limiting between requests."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.rate_limit_seconds:
            time.sleep(self.rate_limit_seconds - elapsed)
        self.last_request_time = time.time()

    def fetch_page(self, url: str, use_playwright: bool = False) -> Optional[str]:
        """
        Fetch a property listing page.

        Args:
            url: URL to fetch
            use_playwright: Use Playwright for JavaScript-heavy pages

        Returns:
            HTML content or None if failed
        """
        self._rate_limit()

        if use_playwright:
            return self._fetch_with_playwright(url)
        else:
            return self._fetch_with_requests(url)

    def _fetch_with_requests(self, url: str) -> Optional[str]:
        """Fetch using simple requests library."""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Error fetching {url}: {e}")
            return None

    def _fetch_with_playwright(self, url: str) -> Optional[str]:
        """Fetch using Playwright for JavaScript rendering."""
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.goto(url, wait_until='networkidle')
                content = page.content()
                browser.close()
                return content
        except Exception as e:
            print(f"Error fetching {url} with Playwright: {e}")
            return None

    def get_text_content(self, html: str) -> str:
        """
        Extract clean text from HTML for Claude to parse.

        Args:
            html: Raw HTML content

        Returns:
            Cleaned text content
        """
        soup = BeautifulSoup(html, 'html.parser')

        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer"]):
            script.decompose()

        # Get text and clean it up
        text = soup.get_text(separator='\n')
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)

        return text


class LoopNetScraper(PropertyScraper):
    """Specialized scraper for LoopNet listings."""

    BASE_URL = "https://www.loopnet.com"

    def search_illinois_properties(
        self,
        property_type: str,
        limit: int = 10
    ) -> list[str]:
        """
        Search for Illinois properties and return listing URLs.

        Args:
            property_type: Type of property (office, retail, etc.)
            limit: Maximum number of URLs to return

        Returns:
            List of property listing URLs
        """
        # This is a placeholder - actual implementation would depend on
        # LoopNet's search structure. You may need to:
        # 1. Check their robots.txt
        # 2. See if they have an API
        # 3. Reverse engineer their search endpoint

        print(f"Note: Actual LoopNet search implementation needed.")
        print(f"For now, provide direct listing URLs to test.")
        return []
