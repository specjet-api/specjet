# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-09-18

### Added
- **`specjet validate` command** - Validate real API implementations against OpenAPI contracts
- Response schema validation with detailed error reporting
- HTTP status code compliance checking
- Authentication support via custom headers (`--header` option)
- Path filtering with `--paths` and `--exclude` options
- Multiple output formats: `text`, `json`, and `junit`
- Request timeout configuration (`--timeout` option)
- Verbose output mode for detailed debugging (`--verbose`)
- CI/CD integration examples for GitHub Actions and Jenkins
- Comprehensive validation documentation and examples

### Changed
- Enhanced configuration system to support validation settings
- Improved error messaging across all commands

## [0.1.1] - 2025-09-17

### Fixed
- Fixed `specjet init` command configuration loading issue
- Generated config files now use CommonJS (`module.exports`) for better compatibility
- Resolved "Failed to load configuration" error when running `specjet generate` after init

## [0.1.0] - 2025-09-16

### Added
- Initial release of SpecJet CLI
- `specjet init` - Initialize new projects with OpenAPI contracts
- `specjet generate` - Generate TypeScript types and API clients
- `specjet mock` - Local mock server with realistic data scenarios
- `specjet docs` - Interactive documentation generation
- Support for demo, realistic, large, and error data scenarios
- File-based contract workflow for individual developers
- Complete offline development capabilities