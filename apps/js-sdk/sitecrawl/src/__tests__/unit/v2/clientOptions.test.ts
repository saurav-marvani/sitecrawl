import { Sitecrawl, SitecrawlClient, type SitecrawlClientOptions } from '../../../index';

describe('Sitecrawl v2 Client Options', () => {
  it('should accept v2 options including timeoutMs, maxRetries, and backoffFactor', () => {
    const options: SitecrawlClientOptions = {
      apiKey: 'test-key',
      timeoutMs: 300,
      maxRetries: 5,
      backoffFactor: 0.5,
    };

    // Should not throw any type errors
    const client = new Sitecrawl(options);
    
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(Sitecrawl);
  });

  it('should work with minimal options', () => {
    const options: SitecrawlClientOptions = {
      apiKey: 'test-key',
    };

    const client = new Sitecrawl(options);
    
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(Sitecrawl);
  });

  it('should work with all v2 options', () => {
    const options: SitecrawlClientOptions = {
      apiKey: 'test-key',
      apiUrl: 'https://custom-api.sitecrawl.dev',
      timeoutMs: 60000,
      maxRetries: 3,
      backoffFactor: 1.0,
    };

    const client = new Sitecrawl(options);
    
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(Sitecrawl);
  });

  it('should export SitecrawlClientOptions type', () => {
    // This test ensures the type is properly exported
    const options: SitecrawlClientOptions = {
      apiKey: 'test-key',
      timeoutMs: 300,
    };

    expect(options.timeoutMs).toBe(300);
    expect(options.apiKey).toBe('test-key');
  });

  it('should accept a string API key in Sitecrawl constructor', () => {
    const client = new Sitecrawl('test-key');

    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(Sitecrawl);
  });

  it('should accept a string API key in SitecrawlClient constructor', () => {
    const client = new SitecrawlClient('test-key');

    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(SitecrawlClient);
  });

  it('should construct without an API key for the keyless free tier', () => {
    // No key: scrape/search/interact use the keyless free tier; the SDK no
    // longer throws at construction.
    expect(() => new Sitecrawl('')).not.toThrow();
    expect(() => new Sitecrawl('   ')).not.toThrow();
  });

  it('should provide v1 accessor when constructed with string', () => {
    const client = new Sitecrawl('test-key');

    expect(client.v1).toBeDefined();
  });
});
