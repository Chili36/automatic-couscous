# Contributing to FoodEx2 Code Validator

Thank you for your interest in contributing to the FoodEx2 Code Validator project! This guide will help you get started with contributing to the project, whether you're fixing bugs, adding features, or improving documentation.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Community](#community)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully
- Prioritize the project's best interests

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/automatic-couscous.git
   cd automatic-couscous
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/Chili36/automatic-couscous.git
   ```

## Development Setup

### Prerequisites

- Node.js v18+ and npm v9+
- SQLite3
- Git
- PM2 (for production testing)

### Installation Steps

1. **Install dependencies**:
   ```bash
   npm install
   cd client && npm install
   cd ..
   ```

2. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Initialize database** (if needed):
   ```bash
   node server/setup-database.js
   ```

4. **Start development servers**:
   ```bash
   # Backend (port 5001)
   npm run dev:backend
   
   # Frontend (port 5178) - in another terminal
   npm run dev:frontend
   ```

### Project Structure

```
├── client/              # Frontend (Vite + Vanilla JS)
│   ├── src/            # Source files
│   └── public/         # Static assets
├── server/             # Backend (Express.js)
│   ├── validators/     # Validation logic
│   └── database.js     # Database layer
├── data/               # Database and configuration
├── docs/               # Documentation
├── test/               # Test files
└── scripts/            # Utility scripts
```

## How to Contribute

### Types of Contributions

1. **Bug Fixes**: Fix reported issues or bugs you discover
2. **Features**: Implement new functionality or enhance existing features
3. **Documentation**: Improve README, API docs, or code comments
4. **Tests**: Add missing tests or improve test coverage
5. **Performance**: Optimize code for better performance
6. **Refactoring**: Improve code structure and maintainability

### Finding Issues to Work On

- Check the [Issues](https://github.com/Chili36/automatic-couscous/issues) page
- Look for issues labeled `good first issue` or `help wanted`
- Review the project roadmap in discussions (if available)

## Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes**:
   - Write clean, documented code
   - Follow existing patterns and conventions
   - Update tests as needed
   - Update documentation if applicable

3. **Test your changes**:
   ```bash
   # Run unit tests
   npm test
   
   # Run validation tests
   npm run test:validation
   
   # Test with sample data
   npm run test:sample
   ```

4. **Commit your changes** (see commit guidelines below)

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

## Code Standards

### JavaScript/Node.js

- **Style**: Use ESLint configuration provided
- **ES Modules**: Prefer ES6+ syntax
- **Async/Await**: Use for asynchronous operations
- **Error Handling**: Always handle errors appropriately
- **Comments**: Document complex logic and public APIs

### Code Style Examples

```javascript
// Good: Clear naming and documentation
/**
 * Validates a FoodEx2 code against business rules
 * @param {string} code - The FoodEx2 code to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult} Validation result object
 */
async function validateCode(code, options = {}) {
    try {
        // Validation logic here
    } catch (error) {
        logger.error('Validation failed:', error);
        throw new ValidationError(error.message);
    }
}

// Use consistent formatting
const config = {
    port: process.env.PORT || 5001,
    database: process.env.DATABASE_PATH,
    cors: {
        origin: process.env.CORS_ORIGIN
    }
};
```

### Database Conventions

- Use parameterized queries to prevent SQL injection
- Index frequently queried columns
- Document schema changes in migrations
- Keep database logic in the data access layer

## Testing Guidelines

### Test Structure

```javascript
describe('FoodEx2 Validator', () => {
    describe('validateCode()', () => {
        it('should validate correct base term codes', async () => {
            // Test implementation
        });
        
        it('should detect invalid facets', async () => {
            // Test implementation
        });
    });
});
```

### Test Coverage Requirements

- New features must include tests
- Bug fixes should include regression tests
- Maintain minimum 80% code coverage
- Test both success and error cases

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- --grep "Validator"

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Commit Guidelines

We follow conventional commits specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Test additions or corrections
- **chore**: Maintenance tasks
- **build**: Build system changes
- **ci**: CI/CD changes

### Examples

```bash
# Feature
git commit -m "feat(validator): add support for composite facets"

# Bug fix
git commit -m "fix(api): handle null values in batch validation"

# Documentation
git commit -m "docs(readme): update installation instructions"

# With body
git commit -m "feat(search): implement fuzzy search algorithm

- Add Levenshtein distance calculation
- Support partial term matching
- Cache search results for performance"
```

## Pull Request Process

1. **Before submitting**:
   - Ensure all tests pass
   - Update documentation if needed
   - Add tests for new functionality
   - Run linter and fix issues
   - Rebase on latest main branch

2. **PR Title Format**:
   ```
   [Type] Brief description
   ```
   Examples:
   - `[Feature] Add Excel import validation`
   - `[Fix] Correct facet interpretation logic`
   - `[Docs] Update API documentation`

3. **PR Description Template**:
   Use the template provided in `.github/PULL_REQUEST_TEMPLATE.md`

4. **Review Process**:
   - PRs require at least one approval
   - Address all review comments
   - Keep PR focused and reasonably sized
   - Update PR based on feedback

5. **After Approval**:
   - Squash commits if requested
   - Ensure CI/CD passes
   - Maintainer will merge

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Detailed steps to reproduce the bug
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - Node.js version
   - OS and version
   - Browser (if frontend issue)
6. **Screenshots/Logs**: If applicable
7. **Sample Data**: FoodEx2 codes that trigger the issue

### Feature Requests

For feature requests, provide:

1. **Use Case**: Why is this feature needed?
2. **Proposed Solution**: How might it work?
3. **Alternatives**: Other solutions considered
4. **Additional Context**: Any other relevant information

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General discussions and questions
- **Pull Requests**: Code contributions and reviews

### Getting Help

- Check existing documentation
- Search closed issues for similar problems
- Ask in GitHub Discussions
- Review the FAQ in the wiki (if available)

### Recognition

Contributors are recognized in:
- The project's CONTRIBUTORS file
- Release notes for significant contributions
- The project README (for major contributors)

## Additional Resources

- [EFSA FoodEx2 Documentation](https://www.efsa.europa.eu/en/data/data-standardisation/food-classification-and-description-efsas-foodex-2-system)
- [Project Documentation](./docs/DOCUMENTATION.md)
- [API Documentation](./docs/openapi.yaml)
- [Developer Guide](./docs/DEVELOPER_GUIDE.md)

## Questions?

If you have questions about contributing, please:
1. Check this guide thoroughly
2. Review existing issues and discussions
3. Create a new discussion if your question isn't answered

Thank you for contributing to the FoodEx2 Code Validator project!