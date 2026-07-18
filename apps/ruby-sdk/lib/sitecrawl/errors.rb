# frozen_string_literal: true

module Sitecrawl
  # Base error class for all Sitecrawl SDK errors.
  class SitecrawlError < StandardError
    attr_reader :status_code, :error_code, :details

    def initialize(message = nil, status_code: nil, error_code: nil, details: nil)
      @status_code = status_code
      @error_code = error_code
      @details = details
      super(message)
    end
  end

  # Raised on 401 Unauthorized responses.
  class AuthenticationError < SitecrawlError
    def initialize(message = nil, error_code: nil, details: nil)
      super(message, status_code: 401, error_code: error_code, details: details)
    end
  end

  # Raised on 429 Too Many Requests responses.
  class RateLimitError < SitecrawlError
    def initialize(message = nil, error_code: nil, details: nil)
      super(message, status_code: 429, error_code: error_code, details: details)
    end
  end

  # Raised when an async job exceeds its timeout.
  class JobTimeoutError < SitecrawlError
    attr_reader :job_id, :timeout_seconds

    def initialize(job_id, timeout_seconds, label = "Job")
      @job_id = job_id
      @timeout_seconds = timeout_seconds
      super("#{label} #{job_id} timed out after #{timeout_seconds} seconds")
    end
  end
end
