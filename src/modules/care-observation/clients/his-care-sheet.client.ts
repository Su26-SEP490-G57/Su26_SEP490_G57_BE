import { Injectable } from '@nestjs/common';
import { HisHttpClient } from '../../his/his-http.client';
import { CareSheetDto, HisCreateCareSheet } from '../dtos/care-sheet.dto';

/**
 * Care-sheet endpoints of the external HIS — the system of record for
 * "Phiếu theo dõi và chăm sóc"; the backend keeps no copy.
 */
@Injectable()
export class HisCareSheetClient {
  constructor(private readonly http: HisHttpClient) {}

  async listByPatient(caseId: string): Promise<CareSheetDto[]> {
    const payload = await this.http.get<{ data?: CareSheetDto[] }>(
      `/care-sheets/patient/${encodeURIComponent(caseId)}`,
    );
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async nextSheetNumber(caseId: string): Promise<number> {
    const payload = await this.http.get<{ sheetNumber?: number }>(
      `/care-sheets/patient/${encodeURIComponent(caseId)}/next-number`,
    );
    return payload?.sheetNumber ?? 1;
  }

  create(sheet: HisCreateCareSheet): Promise<CareSheetDto> {
    return this.http.post<CareSheetDto>('/care-sheets', sheet);
  }
}
