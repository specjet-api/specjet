# Pull Request

## Summary

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test coverage improvement
- [ ] 🏗️ Build system or dependency changes

## Changes Made

<!-- Describe the changes made in more detail -->

## Testing

### General Testing
- [ ] Unit tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] No new TypeScript errors

### CLI Command Testing
<!-- Mark the commands you've tested -->
- [ ] `specjet init` - Tested project initialization
- [ ] `specjet generate` - Tested TypeScript generation
- [ ] `specjet mock` - Tested mock server functionality
- [ ] `specjet validate` - Tested API validation
- [ ] `specjet docs` - Tested documentation generation (if applicable)

### Integration Testing
- [ ] Tested with existing OpenAPI contracts
- [ ] Generated TypeScript compiles successfully
- [ ] Mock server returns expected responses
- [ ] Error handling works as expected

### Manual Testing
<!-- Describe any manual testing performed -->

## CLI Output

<!-- If this affects CLI output, include before/after examples -->

<details>
<summary>CLI Output Example</summary>

```bash
# Include relevant CLI command output here
```

</details>

## Breaking Changes

<!-- If this is a breaking change, describe: -->
<!-- - What breaks -->
<!-- - How users can migrate -->
<!-- - Any deprecation notices needed -->

## Configuration Changes

<!-- If this affects specjet.config.js or OpenAPI contract structure: -->
- [ ] No configuration changes
- [ ] Backward compatible configuration changes
- [ ] Breaking configuration changes (migration guide included)

## Documentation

- [ ] Updated README.md (if applicable)
- [ ] Updated CLI help text (if applicable)  
- [ ] Updated examples (if applicable)
- [ ] Added JSDoc comments to new functions

## Related Issues

<!-- Link to related issues -->
Closes #(issue number)

## Checklist

- [ ] Self-review completed
- [ ] Code follows project conventions
- [ ] Error messages are helpful and actionable
- [ ] Generated code quality is maintained
- [ ] Security considerations addressed (no exposed secrets/keys)
- [ ] Performance impact considered