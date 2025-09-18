---
layout: default
title: Commands
nav_order: 5
has_children: true
description: "Complete reference for all SpecJet CLI commands"
---

# SpecJet CLI Commands

This section contains detailed documentation for all SpecJet CLI commands. Each command includes usage examples, options, and configuration details.

## Core Commands

These 4 commands handle 90% of use cases. **Master these first!**

- **[init](./init.html)** - Initialize a new SpecJet project
- **[generate](./generate.html)** - Generate TypeScript types and API client from OpenAPI contract
- **[mock](./mock.html)** - Start a mock server with realistic data
- **[docs](./docs.html)** - Generate API documentation

## Advanced Commands

> ⚠️ **Advanced Feature**: This is an advanced feature. Most users should focus on the core workflow of init → generate → mock → docs

- **[validate](./validate.html)** - Validate API implementation against your OpenAPI contract

## Quick Reference

**Core Workflow** (start here!):
```bash
# 1. Initialize new project
specjet init my-project

# 2. Generate TypeScript code
specjet generate

# 3. Start mock server
specjet mock

# 4. Generate documentation
specjet docs
```

**Advanced** (after mastering core workflow):
```bash
# Validate API implementation
specjet validate http://localhost:8000
```

For detailed information about each command, click on the command name above or use the navigation sidebar.