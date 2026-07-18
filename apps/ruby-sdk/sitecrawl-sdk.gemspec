# frozen_string_literal: true

require_relative "lib/sitecrawl/version"

Gem::Specification.new do |spec|
  spec.name = "sitecrawl-sdk"
  spec.version = Sitecrawl::VERSION
  spec.authors = ["Sitecrawl"]
  spec.email = ["hello@sitecrawl.dev"]

  spec.summary = "Ruby SDK for the Sitecrawl v2 web scraping API"
  spec.description = "A type-safe Ruby client for the Sitecrawl v2 API. " \
                     "Supports scraping, crawling, batch scraping, URL mapping, " \
                     "web search, and AI agent operations."
  spec.homepage = "https://github.com/saurav-marvani/kineticrawl"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.0.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/saurav-marvani/kineticrawl/tree/main/apps/ruby-sdk"
  spec.metadata["changelog_uri"] = "https://github.com/saurav-marvani/kineticrawl/releases"
  spec.metadata["rubygems_mfa_required"] = "true"

  spec.files = Dir["lib/**/*.rb", "LICENSE", "README.md"]
  spec.require_paths = ["lib"]
end
