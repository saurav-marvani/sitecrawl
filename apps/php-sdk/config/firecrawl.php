<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Sitecrawl API Key
    |--------------------------------------------------------------------------
    |
    | Your Sitecrawl API key. Get one at https://sitecrawl.dev.
    | Falls back to the SITECRAWL_API_KEY environment variable.
    |
    */
    'api_key' => env('SITECRAWL_API_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Sitecrawl API URL
    |--------------------------------------------------------------------------
    |
    | The base URL for the Sitecrawl API.
    | Falls back to the SITECRAWL_API_URL environment variable or the default.
    |
    */
    'api_url' => env('SITECRAWL_API_URL', 'https://api.sitecrawl.dev'),

    /*
    |--------------------------------------------------------------------------
    | Request Timeout
    |--------------------------------------------------------------------------
    |
    | The timeout in seconds for HTTP requests to the Sitecrawl API.
    |
    */
    'timeout' => (float) env('SITECRAWL_TIMEOUT', 300),

    /*
    |--------------------------------------------------------------------------
    | Max Retries
    |--------------------------------------------------------------------------
    |
    | The maximum number of times to retry a failed request.
    | Retryable errors: 408, 409, 502, 5xx, and connection failures.
    |
    */
    'max_retries' => (int) env('SITECRAWL_MAX_RETRIES', 3),

    /*
    |--------------------------------------------------------------------------
    | Backoff Factor
    |--------------------------------------------------------------------------
    |
    | The exponential backoff factor in seconds for retries.
    | Delay = backoff_factor * 2^(attempt - 1)
    |
    */
    'backoff_factor' => (float) env('SITECRAWL_BACKOFF_FACTOR', 0.5),
];
