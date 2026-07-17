<?php

declare(strict_types=1);

namespace Sitecrawl\Laravel\Facades;

use Sitecrawl\Client\SitecrawlClient;
use Sitecrawl\Models\AgentOptions;
use Sitecrawl\Models\AgentStatusResponse;
use Sitecrawl\Models\BatchScrapeJob;
use Sitecrawl\Models\BatchScrapeOptions;
use Sitecrawl\Models\BrowserCreateResponse;
use Sitecrawl\Models\BrowserDeleteResponse;
use Sitecrawl\Models\BrowserExecuteResponse;
use Sitecrawl\Models\BrowserListResponse;
use Sitecrawl\Models\ConcurrencyCheck;
use Sitecrawl\Models\CrawlJob;
use Sitecrawl\Models\CrawlOptions;
use Sitecrawl\Models\CreditUsage;
use Sitecrawl\Models\Document;
use Sitecrawl\Models\MapData;
use Sitecrawl\Models\MapOptions;
use Sitecrawl\Models\ScrapeOptions;
use Sitecrawl\Models\SearchData;
use Sitecrawl\Models\SearchOptions;
use Illuminate\Support\Facades\Facade;

/**
 * @method static Document scrape(string $url, ?ScrapeOptions $options = null)
 * @method static BrowserExecuteResponse interact(string $jobId, string $code, string $language = 'node', ?int $timeout = null, ?string $origin = null)
 * @method static BrowserDeleteResponse stopInteractiveBrowser(string $jobId)
 * @method static CrawlJob crawl(string $url, ?CrawlOptions $options = null, int $pollIntervalSec = 2, int $timeoutSec = 300)
 * @method static CrawlJob getCrawlStatus(string $jobId)
 * @method static array<string, mixed> cancelCrawl(string $jobId)
 * @method static BatchScrapeJob batchScrape(list<string> $urls, ?BatchScrapeOptions $options = null, int $pollIntervalSec = 2, int $timeoutSec = 300)
 * @method static array<string, mixed> cancelBatchScrape(string $jobId)
 * @method static MapData map(string $url, ?MapOptions $options = null)
 * @method static SearchData search(string $query, ?SearchOptions $options = null)
 * @method static AgentStatusResponse agent(AgentOptions $options, int $pollIntervalSec = 2, int $timeoutSec = 300)
 * @method static array<string, mixed> cancelAgent(string $jobId)
 * @method static BrowserCreateResponse browser(?int $ttl = null, ?int $activityTtl = null, ?bool $streamWebView = null)
 * @method static BrowserExecuteResponse browserExecute(string $sessionId, string $code, string $language = 'bash', ?int $timeout = null)
 * @method static BrowserDeleteResponse deleteBrowser(string $sessionId)
 * @method static BrowserListResponse listBrowsers(?string $status = null)
 * @method static ConcurrencyCheck getConcurrency()
 * @method static CreditUsage getCreditUsage()
 *
 * @see SitecrawlClient
 */
class Sitecrawl extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return SitecrawlClient::class;
    }
}
