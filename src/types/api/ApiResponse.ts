export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  timestamp?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
