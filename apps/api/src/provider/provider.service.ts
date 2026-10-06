import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProviderServiceItem { service: number|string; name: string; type?: string; desc?: string|null; category: string; rate: string|number; min: string|number; max: string|number; refill: boolean|number|string }
export interface ProviderStatus { charge: string; start_count: string; status: string; remains: string }

@Injectable()
export class ProviderService {
  constructor(private readonly config: ConfigService) {}
  private async call<T>(action: string, data: Record<string, unknown> = {}, timeoutMs = 12_000): Promise<T> {
    const url = this.config.get<string>('SMM_PROVIDER_URL');
    const key = this.config.get<string>('SMM_PROVIDER_API_KEY');
    if (!url || !key) throw new Error('PROVIDER_NOT_CONFIGURED');
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, action, ...data }), signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    const result = await response.json() as T & { error?: string };
    if (result.error) throw new Error(`PROVIDER_REJECTED:${result.error}`);
    return result;
  }
  services() { return this.call<ProviderServiceItem[]>('services'); }
  balance() { return this.call<{ balance: string; currency: string }>('balance'); }
  addOrder(service: string, link: string, quantity: number, comments?: string) { return this.call<{ order: number }>('add', { service, link, quantity, ...(comments ? { comments } : {}) }, 20_000); }
  status(order: string) { return this.call<ProviderStatus>('status', { order }); }
  refill(order: string) { return this.call<{refill:string|number}>('refill', { order }); }
}
