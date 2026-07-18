import { Sitecrawl } from 'sitecrawl';

// Placeholder v1 example (JavaScript)
// Mirrors the older SDK usage. Replace with your API key before running.

async function main() {
  const app = new Sitecrawl({ apiKey: process.env.SITECRAWL_API_KEY || 'fc-YOUR_API_KEY' });

  const scrape = await app.v1.scrapeUrl('sitecrawl.dev');
  if (scrape && scrape.success) console.log(scrape.markdown);

  const crawl = await app.v1.crawlUrl('mendable.ai', { excludePaths: ['blog/*'], limit: 3 });
  console.log(crawl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});