import { Injectable } from '@nestjs/common';
import { HisHttpClient } from '../../his/his-http.client';
import { HisCreateTreatmentSheet, TreatmentSheetDto } from '../dtos/treatment-sheet.dto';

/**
 * Treatment-sheet endpoints of the external HIS. The HIS is the system of
 * record for "Phiếu theo dõi điều trị" — the backend keeps no copy.
 */
@Injectable()
export class HisTreatmentSheetClient {
  constructor(private readonly http: HisHttpClient) {}

  async listByPatient(caseId: string): Promise<TreatmentSheetDto[]> {
    const payload = await this.http.get<{ data?: TreatmentSheetDto[] }>(
      `/treatment-sheets/patient/${encodeURIComponent(caseId)}`,
    );
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async nextSheetNumber(caseId: string): Promise<number> {
    const payload = await this.http.get<{ sheetNumber?: number }>(
      `/treatment-sheets/patient/${encodeURIComponent(caseId)}/next-number`,
    );
    return payload?.sheetNumber ?? 1;
  }

  create(sheet: HisCreateTreatmentSheet): Promise<TreatmentSheetDto> {
    return this.http.post<TreatmentSheetDto>('/treatment-sheets', sheet);
  }
}
