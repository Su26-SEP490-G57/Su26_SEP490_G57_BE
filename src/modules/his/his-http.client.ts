import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * JSON-over-HTTP client for the external HIS (dummy) service
 * (`HIS_SERVICE_URL`). Any network error or non-2xx response becomes a 502.
 */
@Injectable()
export class HisHttpClient {
  private readonly logger = new Logger(HisHttpClient.name);

  private readonly baseUrl: string;

  private readonly timeoutMs = 10_000;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('HIS_SERVICE_URL') ?? 'http://localhost:4000').replace(
      /\/+$/,
      '',
    );
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            accept: 'application/json',
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HIS responded with ${res.status} ${res.statusText} ${detail}`.trim());
      }
      return (await res.json()) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`${method} ${url} failed: ${message}`);
      throw new HttpException(
        `Unable to reach the external HIS service: ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
