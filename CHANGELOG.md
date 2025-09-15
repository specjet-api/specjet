# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - TBD - Initial Release

### Added
- Core CLI tool with `init`, `generate`, and `mock` commands
- TypeScript type generation from OpenAPI specifications
- Mock server with realistic data generation using Faker.js
- Request validation and comprehensive error handling
- CORS support (enabled by default for development)
- In-memory storage system for mock data persistence
- Custom entity detection and mapping capabilities
- Header parameter support for API requests
- Comprehensive test suite using Vitest
- Stress testing capabilities for performance validation
- Documentation generation from OpenAPI specs
- Example API projects (basic and advanced e-commerce)
- Support for OpenAPI 3.x specifications

### Fixed
- Schema parsing and resolution for complex nested objects
- Parameter naming to avoid underscore anti-patterns
- In-memory storage ID collision errors
- Critical, high, and medium priority code quality issues

### Changed
- Refactored TypeScript generator into focused, maintainable classes
- Enhanced mock data quality and user interface
- Improved CLI output consistency and user experience
- Optimized performance for large API specifications

### Removed
- Health endpoint and non-essential mock API endpoints
- Automatic mock file generation (replaced with in-memory storage)
- README generation from generate command (docs command handles this)