export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    pages: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  details?: string[];
  code?: string;
  statusCode: number;
}