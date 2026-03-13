# Contributing

First off, thank you for considering contributing! It's people like you that make this project such a great tool for the community.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (browser, OS, Node version)

### Suggesting Features

Feature suggestions are tracked as GitHub issues. When suggesting a feature:

- **Use a clear title** describing the feature
- **Provide detailed description** of the proposed functionality
- **Explain the use case** - why is this feature needed?
- **Consider alternatives** you've thought about

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing style
5. Write a clear PR description

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/onboard-platphorm-bp.git
cd onboard-platphorm-bp

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Add your DATABASE_URL

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

## Project Structure

```
app/           # Next.js App Router pages and API routes
components/    # React components
lib/           # Core utilities and helpers
scripts/       # Database migrations and utilities
public/        # Static assets
```

## Coding Standards

### TypeScript
- Use strict TypeScript
- Define interfaces for all data structures
- Avoid `any` types

### React
- Use functional components with hooks
- Follow React Server Components patterns
- Use proper ARIA attributes for accessibility

### CSS
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Ensure WCAG 2.2 compliance

### API Design
- RESTful conventions for REST endpoints
- JSON-RPC 2.0 for MCP endpoints
- Consistent error response format

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- path/to/test.ts

# Run with coverage
pnpm test:coverage
```

### Test Categories

- **Unit tests** for utility functions
- **Integration tests** for API endpoints
- **E2E tests** for critical user flows
- **Accessibility tests** for UI components

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new MCP tool for bulk import
fix: resolve search index race condition
docs: update API documentation
chore: upgrade dependencies
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure CI passes
4. Get at least one review approval
5. Squash and merge

## Release Process

Releases follow [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking API changes
- **MINOR** - New features, backward compatible
- **PATCH** - Bug fixes

## Recognition

Contributors are recognized in:
- Release notes
- Project README

## Questions?

- Open a [Discussion](https://github.com/mbarbine/onboard-platphorm-bp/discussions)
- Join our [Discord](https://discord.gg/platphormnews)
- Email: opensource@platphormnews.com

Thank you for contributing!
