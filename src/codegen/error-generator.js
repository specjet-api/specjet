class ErrorGenerator {
  generateErrorInterface() {
    return `// API Error classes
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: any = null
  ) {
    super(\`HTTP error! status: \${status} \${statusText}\`);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(status: number, statusText: string, body: any = null) {
    super(status, statusText, body);
    this.name = 'ServiceUnavailableError';
  }
}`;
  }
  
  generateErrorHandlingMethod() {
    return `  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    const statusText = response.statusText;
    
    let errorBody: any = null;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
    } catch {
      // Ignore parsing errors
    }

    // Create appropriate error based on status code
    switch (status) {
      case 400:
        throw new BadRequestError(status, statusText, errorBody);
      case 401:
        throw new UnauthorizedError(status, statusText, errorBody);
      case 403:
        throw new ForbiddenError(status, statusText, errorBody);
      case 404:
        throw new NotFoundError(status, statusText, errorBody);
      case 422:
        throw new ValidationError(status, statusText, errorBody);
      case 429:
        throw new RateLimitError(status, statusText, errorBody);
      case 500:
        throw new InternalServerError(status, statusText, errorBody);
      case 502:
      case 503:
      case 504:
        throw new ServiceUnavailableError(status, statusText, errorBody);
      default:
        throw new ApiError(status, statusText, errorBody);
    }
  }`;
  }
}

export default ErrorGenerator;