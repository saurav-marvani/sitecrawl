"""
Sitecrawl v1 API (Legacy)

This module provides the legacy v1 API for backward compatibility.

Usage:
    from sitecrawl.v1 import V1SitecrawlApp
    app = V1SitecrawlApp(api_key="your-api-key")
    result = app.scrape_url("https://example.com")
"""

from .client import V1SitecrawlApp, AsyncV1SitecrawlApp, V1JsonConfig, V1ScrapeOptions, V1ChangeTrackingOptions

__all__ = ['V1SitecrawlApp', 'AsyncV1SitecrawlApp', 'V1JsonConfig', 'V1ScrapeOptions', 'V1ChangeTrackingOptions']