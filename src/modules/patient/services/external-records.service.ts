import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExternalSurgicalRecordDto,
  ExternalSurgicalRecordListDto,
} from '../dtos/external-record.dto';

/**
 * Client for the external HIS (dummy) service. Fetches surgical patient records
 * over HTTP instead of them being entered manually. See dummy-his-service.
 */
@Injectable()
export class ExternalRecordsService {
  private readonly logger = new Logger(ExternalRecordsService.name);

  /** Base URL of the HIS service, e.g. http://localhost:4000. */
  private readonly baseUrl: string;

  /** Request timeout in ms. */
  private readonly timeoutMs = 10_000;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('HIS_SERVICE_URL') ?? 'http://localhost:4000').replace(
      /\/+$/,
      '',
    );
  }

  /** Fetch all surgical patient records from the external HIS. */
  async getSurgicalRecords(): Promise<ExternalSurgicalRecordListDto> {
    const url = `${this.baseUrl}/surgical-records`;

    let payload: ExternalSurgicalRecordListDto;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        throw new Error(`HIS responded with ${res.status} ${res.statusText}`);
      }
      payload = (await res.json()) as ExternalSurgicalRecordListDto;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch surgical records from ${url}: ${message}`);
      throw new HttpException(
        `Unable to reach the external HIS service: ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data: ExternalSurgicalRecordDto[] = Array.isArray(payload?.data) ? payload.data : [];
    return { data, total: payload?.total ?? data.length };
  }
}
