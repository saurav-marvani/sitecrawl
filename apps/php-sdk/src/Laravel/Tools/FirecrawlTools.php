<?php

declare(strict_types=1);

namespace Sitecrawl\Laravel\Tools;

use Sitecrawl\Client\SitecrawlClient;

final class SitecrawlTools
{
    private function __construct() {}

    /**
     * All core Sitecrawl tools, ready to spread into an agent's tools() array.
     *
     * @return list<SitecrawlTool>
     */
    public static function all(?SitecrawlClient $client = null): array
    {
        return [
            new SitecrawlScrape($client),
            new SitecrawlSearch($client),
            new SitecrawlMap($client),
            new SitecrawlCrawl($client),
        ];
    }
}
