# Contributing to SpecJet CLI

Thank you for your interest in contributing to SpecJet CLI! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/specjet-cli.git
   cd specjet-cli
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run tests** to ensure everything works:
   ```bash
   npm test
   npm run lint
   ```

## 🛠 Development Setup

### Prerequisites
- Node.js ≥16.0.0
- npm or yarn package manager
- Git

### Development Commands
```bash
# Run tests
npm test                    # Full test suite
npm run test:watch         # Watch mode
npm run test:ui            # Visual test runner

# Code quality
npm run lint               # ESLint check
npm run audit              # Security audit

# Testing the CLI locally
npm link                   # Make specjet command available globally
specjet --help            # Test the CLI
```

### Project Structure
```
specjet-cli/
├── src/
│   ├── commands/          # CLI commands (init, generate, mock, docs)
│   ├── core/              # Core functionality (parser, config, errors)
│   ├── codegen/           # Code generation (TypeScript, API client)
│   ├── mock-server/       # Mock server implementation
│   └── api/               # Programmatic API
├── tests/                 # Test files
├── examples/              # Example projects
├── bin/specjet           # CLI entry point
└── docs/                 # Documentation
```

## 📝 How to Contribute

### Types of Contributions
- 🐛 **Bug fixes** - Fix issues or improve error handling
- ✨ **Features** - Add new functionality (discuss in issues first)
- 📖 **Documentation** - Improve README, examples, or inline docs
- 🧪 **Tests** - Add test coverage or improve existing tests
- 🎨 **Code quality** - Refactoring, performance improvements

### Before You Start
1. **Check existing issues** to avoid duplicating work
2. **Open an issue** to discuss significant changes before implementing
3. **Follow the coding standards** outlined below

## 🎯 Development Guidelines

### Code Style
- **ES Modules**: Use `import`/`export` syntax
- **Modern JavaScript**: ES2022+ features are encouraged
- **No TypeScript**: Core is JavaScript, but generates TypeScript
- **ESLint**: Follow the configured ESLint rules
- **Formatting**: Consistent spacing and formatting

### Testing Requirements
- **All new features** must include tests
- **Bug fixes** should include regression tests
- **Aim for high coverage** of new code
- **Test both success and error cases**

### Commit Messages
Use conventional commit format:
```
type(scope): description

fix(parser): handle malformed OpenAPI schemas gracefully
feat(mock): add new data scenarios for testing
docs(readme): update installation instructions
test(codegen): add edge case tests for TypeScript generation
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

## 🔄 Pull Request Process

### 1. Branch Naming
```bash
feature/add-new-scenario-type
fix/parser-error-handling
docs/update-contributing-guide
```

### 2. Development Process
1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Update documentation if needed

### 3. Pull Request Requirements
- **Clear description** of changes and motivation
- **Reference related issues** with "Fixes #123" or "Addresses #456"
- **All tests passing** (checked by CI)
- **No ESLint violations**
- **Updated documentation** for new features

### 4. Review Process
- Maintainers will review PRs within 1-2 business days
- Address feedback promptly
- Squash commits before merging if requested

## 🧪 Testing

### Test Categories
- **Unit tests**: Individual functions and classes
- **Integration tests**: End-to-end CLI workflows
- **Performance tests**: Memory and speed optimizations
- **Security tests**: Input validation and error handling

### Running Specific Tests
```bash
# Run specific test file
npx vitest tests/codegen/typescript.test.js

# Run tests matching pattern
npx vitest -t "TypeScript generation"

# Run tests in specific directory
npx vitest tests/mock-server/
```

### Writing Tests
- Use **Vitest** testing framework
- **Descriptive test names**: "should generate valid TypeScript for complex schemas"
- **Arrange, Act, Assert** pattern
- **Mock external dependencies** appropriately
- **Test edge cases** and error conditions

## 🐛 Bug Reports

### Before Submitting
1. **Check existing issues** for duplicates
2. **Try the latest version** to see if it's already fixed
3. **Create a minimal reproduction** if possible

### Bug Report Template
```markdown
**Description**
Brief description of the bug

**Steps to Reproduce**
1. Run `specjet init`
2. Modify contract file...
3. Run `specjet generate`
4. Error occurs

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- SpecJet version: 
- Node.js version:
- Operating System:
- OpenAPI file (if relevant):

**Additional Context**
Any other relevant information
```

## 💡 Feature Requests

### Guidelines
- **Check roadmap** and existing issues first
- **Describe the problem** you're trying to solve
- **Explain the proposed solution** clearly
- **Consider breaking changes** and backwards compatibility
- **Align with project goals** (CLI-first, Phase 1 MVP focus)

### Feature Request Template
```markdown
**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this work?

**Alternatives Considered**
Other approaches you considered

**Implementation Notes**
Technical considerations or constraints
```

## 🏗 Architecture Guidelines

### Key Principles
- **CLI-first design**: Everything works offline
- **Clean separation**: Commands, core logic, and generators are separate
- **Error handling**: Use SpecJetError for consistent error messages
- **Performance**: Handle large schemas efficiently
- **Extensibility**: Design for future plugin system

### Adding New Commands
1. Create command file in `src/commands/`
2. Add command logic and options parsing
3. Register in `src/commands/index.js`
4. Add CLI definition in `bin/specjet`
5. Add comprehensive tests
6. Update help text and documentation

### Adding New Generators
1. Create generator class in `src/codegen/`
2. Follow existing patterns (TypeScriptGenerator, etc.)
3. Add validation and error handling
4. Include comprehensive test coverage
5. Document public methods with JSDoc

## 📄 License

By contributing to SpecJet CLI, you agree that your contributions will be licensed under the MIT license.

## 🤝 Code of Conduct

Be respectful, inclusive, and constructive in all interactions. We're building something useful together!

## 🙋‍♂️ Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Documentation**: Check README.md and inline code comments

## 🎉 Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special thanks for major features or fixes

---

Thank you for contributing to SpecJet CLI! 🚀