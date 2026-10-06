import { HttpException, HttpStatus } from '@nestjs/common';
export class DomainError extends HttpException {
  constructor(public readonly code: string, public readonly messageKey: string, status = HttpStatus.BAD_REQUEST, public readonly details?: Record<string, string | number>) {
    super({ code, messageKey, details }, status);
  }
}
