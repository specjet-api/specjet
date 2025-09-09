# `specjet docs` Command Reference

The `docs` command generates beautiful, static documentation for your OpenAPI contract in a single HTML file.

## Basic Usage

```bash
specjet docs [options]
```

## Examples

### Generate Static Documentation
```bash
specjet docs

# Output:
# 📚 Generating documentation...
# 📖 Parsing OpenAPI contract...
#    Found 2 schemas
#    Found 3 endpoints
# 🎨 Generating HTML documentation...
# 📝 Writing documentation...
# ✅ Documentation generated successfully!
#    📄 File: ./docs.html
#    💡 Tip: Open in your browser to view
```

### Start Documentation Server
```bash
# Serve documentation on localhost
specjet docs --port 3003

# Output:
# 📚 Starting documentation server...
# 📖 Parsing OpenAPI contract...
#    Found 2 schemas
#    Found 3 endpoints
# 🎨 Generating HTML documentation...
# ✅ Documentation server started!
#    🌐 Server: http://localhost:3003
#    📄 Documentation: http://localhost:3003
#    💡 Press Ctrl+C to stop the server
```

### Auto-open in Browser
```bash
# Generate docs and open in default browser
specjet docs --open

# Start server and open in browser
specjet docs --port 3003 --open
```

### Custom Output Location
```bash
# Generate to custom file
specjet docs --output ./public/api-docs.html

# Generate to directory (creates index.html)
specjet docs --output ./dist/docs/
```

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port <number>` | Start server on specified port | `3003` |
| `--open` | Open documentation in browser | `false` |
| `--output <path>` | Output file or directory path | `./docs.html` |
| `--config <path>` | Custom configuration file | `./specjet.config.js` |

## Documentation Features

### Single HTML File
The generated documentation is completely self-contained:

```html
<!-- Everything embedded in one file -->
<!DOCTYPE html>
<html>
<head>
  <style>/* All CSS embedded */</style>
</head>
<body>
  <!-- Complete documentation -->
  <script>/* All JavaScript embedded */</script>
</body>
</html>
```

**Benefits:**
- Share documentation as a single file
- Works offline without dependencies
- Easy to host on any web server
- No external CDN dependencies

### Responsive Design
Documentation adapts to all screen sizes:

```css
/* Desktop: sidebar navigation */
@media (min-width: 768px) {
  .sidebar { display: block; }
}

/* Mobile: collapsible navigation */
@media (max-width: 767px) {
  .sidebar { display: none; }
  .mobile-menu { display: block; }
}
```

### Dark/Light Theme Toggle
Built-in theme switcher with system preference detection:

```javascript
// Automatic theme detection
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
document.body.setAttribute('data-theme', prefersDark.matches ? 'dark' : 'light');
```

**Usage:**
- Click the 🌓 icon to toggle themes
- Preference saved in localStorage
- Respects system dark/light mode

### Mock Data Preview
Each endpoint shows realistic example responses:

```yaml
# Your contract endpoint
/users:
  get:
    responses:
      '200':
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/User'
```

```javascript
// Generated mock data preview
[
  {
    "id": 1,
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "isActive": true,
    "createdAt": "2023-10-15T14:23:17Z"
  }
]
```

### Copy-to-Clipboard Examples
Quick copying for common integration patterns:

**cURL Examples:**
```bash
# Copy button available for each endpoint
curl -X GET "http://localhost:3001/users" \
  -H "Accept: application/json"
```

**TypeScript Usage:**
```typescript
// Copy button available for generated code
import { ApiClient } from './src/api/client';
const api = new ApiClient('http://localhost:3001');
const users = await api.getUsers();
```

### Sidebar Navigation
Organized navigation with endpoint grouping:

```html
<!-- Generated navigation structure -->
<nav class="sidebar">
  <div class="nav-section">
    <h3>Endpoints</h3>
    <ul>
      <li><a href="#get-users">GET /users</a></li>
      <li><a href="#post-users">POST /users</a></li>
      <li><a href="#get-users-id">GET /users/{id}</a></li>
    </ul>
  </div>
  <div class="nav-section">
    <h3>Schemas</h3>
    <ul>
      <li><a href="#schema-user">User</a></li>
      <li><a href="#schema-create-user-request">CreateUserRequest</a></li>
    </ul>
  </div>
</nav>
```

## Server Mode vs Static Files

### Server Mode (`--port`)
Perfect for development and real-time updates:

```bash
specjet docs --port 3003
```

**Features:**
- Live server on specified port
- Auto-refresh when contract changes (future feature)
- CORS headers for development
- Health check endpoint

**Use Cases:**
- Development documentation server
- Team sharing during development
- Integration with development workflow

### Static File Generation (default)
Perfect for deployment and sharing:

```bash
specjet docs --output ./public/docs.html
```

**Features:**
- Single HTML file output
- No server dependencies
- Easy deployment to CDN
- Shareable documentation

**Use Cases:**
- Production documentation hosting
- Documentation as part of build process
- Sharing with external teams
- Offline documentation

## Development Workflow

### Concurrent Development
Run documentation server alongside your development:

```bash
# Terminal 1: Documentation server
specjet docs --port 3003

# Terminal 2: Mock server for API testing
specjet mock --port 3001

# Terminal 3: Frontend development
npm run dev
```

### Package.json Integration
Add convenient scripts to your project:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run mock\" \"npm run docs\" \"npm start\"",
    "api:docs": "specjet docs --port 3003",
    "api:docs:build": "specjet docs --output ./public/api-docs.html",
    "api:docs:open": "specjet docs --open",
    "mock": "specjet mock --port 3001",
    "docs:deploy": "specjet docs --output ./dist/docs.html"
  }
}
```

### Build Process Integration
Include documentation in your build pipeline:

```bash
# CI/CD build script
npm run build
specjet docs --output ./dist/api-docs.html
aws s3 cp ./dist/api-docs.html s3://my-bucket/docs/
```

## Output Structure

### Single File Output
```bash
specjet docs --output ./api-docs.html
```

Creates:
```
api-docs.html    # Complete documentation file
```

### Directory Output
```bash
specjet docs --output ./docs/
```

Creates:
```
docs/
└── index.html   # Complete documentation file
```

### Custom Naming
```bash
specjet docs --output ./public/my-api-docs.html
```

Creates:
```
public/
└── my-api-docs.html   # Complete documentation file
```

## Configuration Integration

Documentation respects settings from `specjet.config.js`:

```javascript
export default {
  contract: './api-contract.yaml',
  
  docs: {
    title: 'My API Documentation',    // Custom title
    port: 3003,                       // Default port
    output: './docs.html',            // Default output
    theme: 'light',                   // Default theme
    
    // Future customization options
    logo: './assets/logo.svg',
    customCss: './custom-styles.css',
    analytics: 'GA-XXXXXXXXX'
  }
};
```

## Customization Options

### Branding and Styling
The generated documentation includes your API information:

```yaml
# api-contract.yaml
info:
  title: My Amazing API           # Used as page title
  version: 1.0.0                 # Shown in header
  description: |                 # Shown as introduction
    This API provides comprehensive
    user management functionality.
  contact:
    name: API Support
    url: https://example.com/support
    email: api@example.com
```

### Custom Themes (Future Feature)
```bash
# Future capability
specjet docs --theme custom --css ./branding.css
specjet docs --logo ./company-logo.svg
```

## Deployment Examples

### Static Site Hosting

**GitHub Pages:**
```bash
# Build docs to docs/ directory
specjet docs --output ./docs/index.html
git add docs/index.html
git commit -m "Update API documentation"
git push origin main
```

**Netlify/Vercel:**
```bash
# Build step
specjet docs --output ./public/api-docs.html

# Deploy entire public/ directory
```

**AWS S3:**
```bash
# Build and upload
specjet docs --output ./api-docs.html
aws s3 cp ./api-docs.html s3://my-bucket/docs.html
```

### Integration with Documentation Sites

**Docusaurus:**
```bash
# Generate to static directory
specjet docs --output ./docusaurus/static/api-docs.html
```

**GitBook/Notion:**
- Generate documentation file
- Upload as attachment or embed
- Link from main documentation

## Mock Server Integration

### Separate Documentation and Mock Servers
Run documentation and mock servers independently for clean separation:

```bash
# Terminal 1: Documentation server (port 3002)
specjet docs

# Terminal 2: Mock server (port 3001)  
specjet mock
```

**Available endpoints:**
- `http://localhost:3002` - Documentation server
- `http://localhost:3001` - Mock API server
- Complete separation of concerns

### Separate Servers
```bash
# Terminal 1: Documentation server
specjet docs --port 3003

# Terminal 2: Mock API server
specjet mock --port 3001

# Documentation points to mock server examples
```

## Browser Compatibility

The generated documentation works in all modern browsers:

- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

**Features used:**
- CSS Grid and Flexbox
- ES6 JavaScript
- LocalStorage
- CSS Custom Properties

**Fallbacks included:**
- JavaScript disabled graceful degradation
- Basic CSS styling for older browsers
- No external dependencies required

## Performance Considerations

### File Size
- **Typical documentation**: 50-200KB
- **Large APIs (50+ endpoints)**: 300-500KB
- **Complex schemas**: Additional 100KB per 20 schemas

### Loading Speed
- **Initial load**: < 1 second (typical broadband)
- **Theme switching**: Instant (CSS custom properties)
- **Navigation**: Instant (client-side anchors)

### Optimization Tips
```bash
# Generate smaller files for large APIs
specjet docs --compact  # Future feature: minified output
```

## Troubleshooting

### Documentation Not Generating

**Check contract file:**
```bash
# Verify contract exists and is valid
specjet validate ./api-contract.yaml
```

**Common issues:**
- Missing `api-contract.yaml` file
- Invalid OpenAPI syntax
- No paths or schemas defined

### Server Won't Start

**Port already in use:**
```bash
# Try different port
specjet docs --port 3004

# Find what's using the port
lsof -i :3003
```

**Permission errors:**
```bash
# Try ports above 1024
specjet docs --port 8080
```

### Browser Not Opening

**Manual access:**
```bash
# Server mode
open http://localhost:3003

# Static file
open ./docs.html
```

**Check firewall settings:**
- Allow Node.js through firewall
- Verify localhost access permissions

### Styling Issues

**Theme not working:**
- Check browser console for JavaScript errors
- Clear browser cache and reload
- Try different browser

**Mobile display problems:**
- Check viewport meta tag (included automatically)
- Test in browser developer tools mobile view

## Related Commands

- **[`generate`](./generate.md)**: Generate TypeScript types and client
- **[`mock`](./mock.md)**: Start mock server with API endpoints
- **[`init`](./init.md)**: Initialize project with contract template
- **[`validate`](./validate.md)**: Validate contract syntax and structure

## Next Steps

After generating your documentation:

1. **Review Generated Docs**: Open the HTML file to verify content
2. **Customize Contract**: Add descriptions, examples, and metadata
3. **Share with Team**: Deploy documentation or share HTML file
4. **Run with Mock Server**: Start both servers for full development workflow
5. **Automate Generation**: Add to build scripts and CI/CD pipeline

## Advanced Examples

### Documentation for Authentication APIs
```yaml
# Contract with auth examples
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token from /auth/login

security:
  - BearerAuth: []
```

### Complex Schema Documentation
```yaml
# Nested schemas with examples
components:
  schemas:
    User:
      type: object
      description: A user in the system
      example:
        id: 123
        name: "John Doe"
        profile:
          bio: "Software engineer"
          avatar: "https://example.com/avatar.jpg"
      properties:
        id: {type: integer, description: "Unique user ID"}
        name: {type: string, description: "Full name", example: "John Doe"}
        profile: {$ref: "#/components/schemas/UserProfile"}
```

The documentation generator automatically formats examples, descriptions, and nested schemas for optimal readability.