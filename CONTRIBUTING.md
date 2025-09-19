.# Contributing to AuthFlow

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Start development build: `npm run dev`

## Scripts

- `npm run build` - Build the package
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Fix linting issues
- `npm run lint:check` - Check for linting issues
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

## Testing

- All code changes should include tests
- Run `npm test` to ensure all tests pass
- Maintain or improve test coverage

## Code Style

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint and Prettier)
- Write clear, descriptive commit messages

## Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes with tests
3. Run `npm run lint` and `npm test`
4. Submit a pull request to `develop` branch
5. Ensure CI passes

## Commit Messages

Use conventional commits format:

- `feat: add new feature`
- `fix: bug fix`
- `docs: documentation changes`
- `test: add tests`
- `refactor: code refactoring`
- `chore: maintenance tasks`

## Release Process

Releases are handled by maintainers:

- `npm run release:patch` - Bug fixes
- `npm run release:minor` - New features
- `npm run release:major` - Breaking changes
