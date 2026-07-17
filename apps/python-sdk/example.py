#!/usr/bin/env python3
"""
Minimal examples for Sitecrawl v2.
"""

import os
from dotenv import load_dotenv
from sitecrawl import Sitecrawl
 

load_dotenv()

def main():
    api_key = os.getenv("SITECRAWL_API_KEY")
    if not api_key:
        raise ValueError("SITECRAWL_API_KEY is not set")
    
    api_url = os.getenv("SITECRAWL_API_URL")
    if not api_url:
        raise ValueError("SITECRAWL_API_URL is not set")

    sitecrawl = Sitecrawl(api_key=api_key, api_url=api_url)

    # Scrape
    doc = sitecrawl.scrape("https://docs.sitecrawl.dev", formats=["markdown"])
    print("scrape:", doc.markdown)
    # doc.metadata_dict is a dict, doc.metadata_typed is a DocumentMetadata object
    print(doc.metadata_dict.get("source_url"))
    print('metadata_dict.get("title"):', doc.metadata_dict.get("title"))
    print("metadata_typed.title:", doc.metadata_typed.title)
    print("metadata.title", doc.metadata.title if doc.metadata else None)


    # Crawl (waits until terminal state)
    crawl_job = sitecrawl.crawl("https://docs.sitecrawl.dev", limit=3, poll_interval=1, timeout=120)
    print("crawl:", crawl_job.status, crawl_job.completed, "/", crawl_job.total)

    # Batch scrape
    batch = sitecrawl.batch_scrape([
        "https://docs.sitecrawl.dev",
        "https://sitecrawl.dev",
    ], formats=["markdown"], poll_interval=1, wait_timeout=120)
    print("batch:", batch.status, batch.completed, "/", batch.total)

    # Search
    search_response = sitecrawl.search(query="What is the capital of France?", limit=5)
    print("search web results:", len(getattr(search_response, "web", []) or []))

    # Map
    map_response = sitecrawl.map("https://sitecrawl.dev")
    print("map links:", len(getattr(map_response, "links", []) or []))

if __name__ == "__main__":
    main()
