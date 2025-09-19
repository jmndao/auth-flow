# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [](https://github.com/jmndao/auth-flow/compare/v2.1.1...v) (2025-09-19)


### ⚠ BREAKING CHANGES

* Complete rewrite with separated concerns

- Split authentication and permission systems into separate modules
- Auth class now focuses purely on authentication (login, logout, tokens)
- Permission system is completely separate and can wrap components
- Maintain custom validation support with both config and parameter approaches
- Cleaner modular design with single responsibility per class
- Component-wrappable permission guards for framework integration
- Improved testability and maintainability

Migration:
- createAuthFlow() API remains the same for basic usage
- Permission checking now uses separate Permissions module
- Custom validation still supported in auth config
- New component guard patterns available

Files:
- Refactored auth.ts (simplified, focused)
- New auth-manager.ts (extracted complex auth logic)
- New permissions/ module (RBAC, ABAC, guards)
- Updated tests for new architecture
- Clean separation allows independent usage of each system

### Features

* add automated release system and fix prepublishOnly ([873fcce](https://github.com/jmndao/auth-flow/commit/873fcce646adbffb06acba2af06b4ac25bffe754))
* add CI workflow and issue templates for bug reports and pull requests ([4db0617](https://github.com/jmndao/auth-flow/commit/4db0617f2ca33cf1a2220222056c206f4eee4e36))
* complete architecture refactor - separate auth and permissions (v3.0.0) ([d200a16](https://github.com/jmndao/auth-flow/commit/d200a16d018eb7857743f6fa265837251e73867f))
* re-implement auth-flow based on old version ([60d64de](https://github.com/jmndao/auth-flow/commit/60d64ded97a65173feac13fbc87a957841b611b4))


### Bug Fixes

* add isRetry property to RequestConfig interface for better request handling ([3eb3912](https://github.com/jmndao/auth-flow/commit/3eb391292cdc98c541ef387d579e4f893b5fd606))
* avoid mutation of request config during token refresh retry ([3d396ff](https://github.com/jmndao/auth-flow/commit/3d396ff3182b5bb1745b5b75d4711ecd1347b103))
* change module export syntax from ES6 to CommonJS in rollup configuration ([39dedac](https://github.com/jmndao/auth-flow/commit/39dedac8fe3eb6dc8bf3b8ea71ff3370efba41b2))
* correct casing of README.md in package.json files list ([c17e64c](https://github.com/jmndao/auth-flow/commit/c17e64cd67d9fb9921ea076ebba5df1aa206cce9))
* refactor JWT handling - extract claims and expiration checks into utility functions ([b77b8bd](https://github.com/jmndao/auth-flow/commit/b77b8bd612c04bcc32c99235d2f493d7720de790))
* replace 'any' with 'unknown' in type definitions for better type safety ([7cd689a](https://github.com/jmndao/auth-flow/commit/7cd689a78636ebeeb1fd55d70ad65529ce379110))
* replace deprecated rollup-plugin-terser with @rollup/plugin-terser and update package-lock.json ([584b21c](https://github.com/jmndao/auth-flow/commit/584b21c1dc6fe11ee78b7ead2d3211283704a881))
* simplify ESLint configuration by removing unused plugins and rules ([0866b57](https://github.com/jmndao/auth-flow/commit/0866b57977176b0799c59a4c6657526b7652b46d))
* simplify GitHub Actions workflow to manual trigger only ([fa9b6ab](https://github.com/jmndao/auth-flow/commit/fa9b6abbffb3adf0ffd78cb1179497b5d617593e))
* update author information in package.json ([b0e4251](https://github.com/jmndao/auth-flow/commit/b0e4251e640ae86ddacd65b224cc76cb9a2f471f))

## [2.1.1] - 2025-07-05

### Code Refactoring

- enhance token validation and refresh logic in AuthClient and middleware (38f917a)

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