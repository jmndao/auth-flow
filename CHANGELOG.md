# Changelog

## [Unreleased]

### Bug Fixes

- add proper TypeScript declarations for middleware module (02560d7)

## [2.0.2] - 2025-07-02

### Bug Fixes

- improve Next.js cookie handling and add middleware support (79bed59)

## [1.0.1] - 2025-06-30

### Features

- add automated versioning and changelog system (2cf39e0)

### Other Changes

- Initial commit: Universal authentication client for JavaScript applications (f6eb7f1)

## [1.0.0] - 2024-12-24

### Features

- Universal authentication client for JavaScript applications
- Automatic token rotation with access and refresh tokens
- Multiple storage adapters (localStorage, cookies, memory)
- Environment auto-detection (client/server/universal)
- Smart request queuing during token refresh
- Comprehensive error handling with retry logic
- Full TypeScript support with type definitions
- Next.js server-side and client-side compatibility
- Axios-based HTTP client with authentication interceptors
- Configurable token extraction from response body or cookies

### Documentation

- Complete README with usage examples
- API documentation with TypeScript interfaces
- Professional landing page design
- Comprehensive test suite with Jest

### Development

- Rollup build pipeline for ES modules and CommonJS
- ESLint and Prettier configuration
- Jest testing environment with jsdom
- TypeScript configuration for strict type checking
- Automated versioning and changelog generation