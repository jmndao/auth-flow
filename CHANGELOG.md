# Changelog

## [2.1.0] - 2025-07-05

### Documentation

- update CHANGELOG for v2.1.0 (38c461f)

## [2.1.0] - 2025-07-05

### Added
- Comprehensive middleware setup guide for Next.js
- Enhanced error messages with Next.js guidance for server environments

### Fixed
- Removed debug logs and added professional comments
- Fixed linting issues (unused variables, exception handling)
- Updated all documentation to match cleaned implementation
- Fixed framework compatibility examples

### Changed
- Updated API reference, examples, and troubleshooting guides
- Improved error handling and token validation logic

## [2.0.8] - 2025-07-05

### Features

- clean up codebase and update docs (fd3e12c)

### Documentation

- update CHANGELOG (0a8fc21)

### Other Changes

- 2.0.7 (67706ac)

## [2.0.7] - 2025-07-05

### Features

- clean up codebase and update docs (fd3e12c)

## [2.0.6] - 2025-07-04

### Features

- feat(auth): add automatic context detection to createAuthFlowV2 (a3c1999)

### Bug Fixes

- fix(auth): add cookie extraction fallback and retry mechanisms (9c09cb0)

### Other Changes

- build: optimize bundle size by removing production source maps (f0905a5)

## [2.0.5] - 2025-07-03

### Bug Fixes

- update types path for middleware export in package.json (f980c2f)

## [2.0.4] - 2025-07-02

### Bug Fixes

- update homepage URL in package.json (54fa057)

## [2.0.3] - 2025-07-02

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