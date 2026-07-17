<?php

declare(strict_types=1);

use Sitecrawl\Laravel\Tools\SitecrawlCrawl;
use Sitecrawl\Laravel\Tools\SitecrawlMap;
use Sitecrawl\Laravel\Tools\SitecrawlScrape;
use Sitecrawl\Laravel\Tools\SitecrawlSearch;
use Sitecrawl\Laravel\Tools\SitecrawlTools;
use GuzzleHttp\Psr7\Response;
use Laravel\Ai\Tools\Request;

it('returns one instance of each core tool', function (): void {
    $tools = SitecrawlTools::all();

    expect($tools)->toHaveCount(4);
    expect($tools[0])->toBeInstanceOf(SitecrawlScrape::class);
    expect($tools[1])->toBeInstanceOf(SitecrawlSearch::class);
    expect($tools[2])->toBeInstanceOf(SitecrawlMap::class);
    expect($tools[3])->toBeInstanceOf(SitecrawlCrawl::class);
});

it('passes an explicit client through to every tool', function (): void {
    $client = fakeSitecrawlClient([
        new Response(200, [], json_encode(['success' => true, 'data' => ['markdown' => '# Hi']])),
        new Response(200, [], json_encode(['success' => true, 'data' => [
            'web' => [['title' => 'T', 'url' => 'https://a.com', 'description' => 'D']],
        ]])),
        new Response(200, [], json_encode(['success' => true, 'data' => [
            'links' => [['url' => 'https://a.com']],
        ]])),
        new Response(200, [], json_encode(['success' => true, 'id' => 'job-1'])),
        new Response(200, [], json_encode([
            'success' => true, 'status' => 'completed', 'total' => 0, 'completed' => 0, 'data' => [],
        ])),
    ]);

    [$scrape, $search, $map, $crawl] = SitecrawlTools::all($client);

    expect($scrape->handle(new Request(['url' => 'https://example.com'])))->toBe('# Hi');
    expect($search->handle(new Request(['query' => 'hi'])))->toContain('https://a.com');
    expect($map->handle(new Request(['url' => 'https://example.com'])))->toContain('https://a.com');
    expect(json_decode($crawl->handle(new Request(['url' => 'https://example.com'])), true)['status'])
        ->toBe('completed');
});
