// Advanced SpecJet configuration for project management API
// Demonstrates custom entity patterns for contextual mock data generation
// Only includes features actually supported by SpecJet CLI

export default {
  // OpenAPI contract file location
  contract: './api-contract.yaml',
  
  // Output directories for generated code
  output: {
    types: './src/types',      // TypeScript interfaces and types
    client: './src/api'        // Generated API client
  },
  
  // TypeScript generation options
  typescript: {
    clientName: 'ProjectApi'   // Name of the generated API client class
  },
  
  // Mock server configuration
  mock: {
    port: 3001,                // Mock server port
    cors: true,                // Enable CORS (always enabled)
    scenario: 'realistic',     // Default data generation scenario
    
    // Custom entity patterns for project management domain
    // These patterns help SpecJet generate contextually appropriate mock data
    entityPatterns: {
      // Users and team members - enhanced patterns for project context
      user: /^(user|member|assignee|owner|creator|reporter|author|leader|contributor)s?$/i,
      
      // Project management core entities
      project: /^projects?$/i,
      task: /^(task|todo|issue|ticket|item)s?$/i,
      milestone: /^(milestone|deliverable|goal)s?$/i,
      workspace: /^(workspace|space|organization|org)s?$/i,
      
      // Collaboration and communication
      comment: /^(comment|note|update|discussion|reply)s?$/i,
      file: /^(file|attachment|document|upload)s?$/i,
      activity: /^(activity|event|action|log)s?$/i,
      
      // Time and productivity tracking
      timelog: /^(timelog|timeentry|worklog|hour)s?$/i,
      sprint: /^(sprint|iteration|cycle)s?$/i,
      
      // Organization and teams
      team: /^teams?$/i,
      
      // Advanced project entities
      label: /^(label|tag|category)s?$/i,
      notification: /^(notification|alert|reminder)s?$/i
    },
    
    // Domain mappings for contextual data generation
    domainMappings: {
      user: 'users',              // Professional user profiles
      project: 'productivity',    // Project management focused data
      task: 'productivity',       // Task and work item data
      milestone: 'productivity',   // Goal and timeline data
      workspace: 'productivity',  // Organizational data
      comment: 'productivity',    // Collaboration content
      file: 'productivity',       // Document and attachment data
      activity: 'productivity',   // Activity and event data
      timelog: 'productivity',    // Time tracking data
      sprint: 'productivity',     // Agile methodology data
      team: 'productivity',       // Team and organizational data
      label: 'productivity',      // Categorization data
      notification: 'productivity' // Communication data
    }
  },
  
  // Documentation server settings
  docs: {
    port: 3002
  },

  // Environment configurations for API validation
  // Used by `specjet validate <environment>` command to test API endpoints
  // against real or staging environments
  environments: {

    // Staging environment for pre-production testing
    staging: {
      url: 'https://api-staging.projectmanager.com',
      headers: {
        'Authorization': 'Bearer ${STAGING_API_TOKEN}',
        'X-API-Version': '2.0',
        'X-Debug-Mode': 'true'
      }
    },

    // Development environment
    dev: {
      url: 'https://api-dev.projectmanager.com',
      headers: {
        'Authorization': 'Bearer ${DEV_API_TOKEN}',
        'X-API-Version': '2.0-beta'
      }
    },

    // Local development environment
    local: {
      url: 'http://localhost:8080',
      headers: {
        'X-Debug-Mode': 'true'
      }
      // No authentication required for local development
    },
  }
};