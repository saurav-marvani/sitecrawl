<?php

declare(strict_types=1);

namespace Sitecrawl\Exceptions;

class AuthenticationException extends SitecrawlException
{
    public function __construct(
        string $message = 'Authentication failed. Check your API key.',
        ?string $errorCode = null,
        mixed $details = null,
    ) {
        parent::__construct($message, 401, $errorCode, $details);
    }
}
