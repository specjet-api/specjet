class AuthGenerator {
  generateAuthInterface() {
    return `// Authentication configuration types
interface ApiKeyAuth {
  type: 'apiKey';
  apiKey: string;
  headerName: string;
}

interface BearerAuth {
  type: 'bearer';
  token: string;
}

interface BasicAuth {
  type: 'basic';
  username: string;
  password: string;
}

interface CustomAuth {
  type: 'custom';
  headers: Record<string, string>;
}

type AuthConfig = ApiKeyAuth | BearerAuth | BasicAuth | CustomAuth;`;
  }
  
  generateAuthMethods(clientName) {
    return `  setAuth(config: AuthConfig): ${clientName} {
    // Add validation for auth config
    if (config.type === 'bearer' && typeof config.token !== 'string') {
      throw new Error('Bearer token must be a string');
    }
    if (config.type === 'bearer' && !config.token.trim()) {
      throw new Error('Bearer token cannot be empty');
    }
    if (config.type === 'basic' && (typeof config.username !== 'string' || typeof config.password !== 'string')) {
      throw new Error('Basic auth username and password must be strings');
    }
    this.authConfig = config;
    return this;
  }

  setApiKey(apiKey: string, headerName: string = 'X-API-Key'): ${clientName} {
    return this.setAuth({ type: 'apiKey', apiKey, headerName });
  }

  setBearerToken(token: string): ${clientName} {
    return this.setAuth({ type: 'bearer', token });
  }

  setBasicAuth(username: string, password: string): ${clientName} {
    return this.setAuth({ type: 'basic', username, password });
  }`;
  }
  
  generateBuildHeadersMethod() {
    return `  private buildHeaders(requestHeaders: HeadersInit = {}): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.options.headers as Record<string, string>,
      ...requestHeaders as Record<string, string>,
    };

    // Add authentication headers
    if (this.authConfig) {
      switch (this.authConfig.type) {
        case 'apiKey':
          headers[this.authConfig.headerName] = this.authConfig.apiKey;
          break;
        case 'bearer':
          headers['Authorization'] = 'Bearer ' + this.authConfig.token;
          break;
        case 'basic':
          const credentials = btoa(this.authConfig.username + ':' + this.authConfig.password);
          headers['Authorization'] = 'Basic ' + credentials;
          break;
        case 'custom':
          Object.assign(headers, this.authConfig.headers);
          break;
      }
    }

    return headers;
  }`;
  }
  
  generateAuthProperties() {
    return `  private authConfig: AuthConfig | null = null;`;
  }
}

export default AuthGenerator;