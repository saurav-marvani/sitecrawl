<?php

declare(strict_types=1);

namespace Sitecrawl\Laravel;

use Sitecrawl\Client\SitecrawlClient;
use Illuminate\Support\ServiceProvider;

class SitecrawlServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/sitecrawl.php', 'sitecrawl');

        $this->app->singleton(SitecrawlClient::class, function ($app): SitecrawlClient {
            /** @var array<string, mixed> $config */
            $config = $app['config']->get('sitecrawl', []);

            $apiKey = isset($config['api_key']) && is_string($config['api_key'])
                ? trim($config['api_key'])
                : null;

            if ($apiKey === '') {
                $apiKey = null;
            }

            return SitecrawlClient::create(
                apiKey: $apiKey,
                apiUrl: isset($config['api_url']) && is_string($config['api_url']) ? $config['api_url'] : null,
                timeoutSeconds: (float) ($config['timeout'] ?? 300),
                maxRetries: (int) ($config['max_retries'] ?? 3),
                backoffFactor: (float) ($config['backoff_factor'] ?? 0.5),
            );
        });

        $this->app->alias(SitecrawlClient::class, 'sitecrawl');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../../config/sitecrawl.php' => $this->app->configPath('sitecrawl.php'),
            ], 'sitecrawl-config');
        }
    }

    /** @return list<string> */
    public function provides(): array
    {
        return [SitecrawlClient::class, 'sitecrawl'];
    }
}
