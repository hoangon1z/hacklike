export type ApiErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'INSUFFICIENT_BALANCE'
  | 'SERVICE_UNAVAILABLE' | 'ORDER_QUANTITY_OUT_OF_RANGE'
  | 'PROVIDER_UNAVAILABLE' | 'RATE_CHANGED' | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  success: false;
  error: { code: ApiErrorCode; messageKey: string; requestId: string; details?: Record<string, number | string> };
}

export interface ApiSuccess<T> { success: true; data: T }
export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export type PublicOrderStatus =
  | 'RECEIVED' | 'WAITING' | 'PROCESSING' | 'COMPLETED'
  | 'PARTIAL' | 'CANCELED' | 'REFUNDED' | 'REVIEWING';

export interface ServiceDto {
  id: string; providerServiceId: string; name: string; category: string;
  sellingRate: string; min: number; max: number; refill: boolean;
}
