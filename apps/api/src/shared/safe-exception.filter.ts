import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const body = typeof raw === 'object' && raw && 'code' in raw
      ? raw as { code: string; messageKey: string; details?: Record<string, unknown> }
      : { code: status === 401 ? 'UNAUTHORIZED' : status < 500 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', messageKey: status < 500 ? 'request.invalid' : 'system.temporarily_unavailable' };
    if (status >= 500) console.error({ requestId, exception });
    response.status(status).json({ success: false, error: { ...body, requestId } });
  }
}
