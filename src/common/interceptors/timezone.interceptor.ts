/* eslint-disable no-prototype-builtins */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor to convert all Date objects in response to Asia/Ho_Chi_Minh timezone
 * before JSON serialization. Converts UTC timestamps to format: "2026-07-16T00:56:31+07:00"
 */
@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.convertDatesToTimezone(data)));
  }

  private convertDatesToTimezone(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle Date objects
    if (obj instanceof Date) {
      return this.formatDateToVietnamTimezone(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertDatesToTimezone(item));
    }

    // Handle plain objects
    if (typeof obj === 'object' && obj.constructor === Object) {
      const converted: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          converted[key] = this.convertDatesToTimezone(obj[key]);
        }
      }
      return converted;
    }

    return obj;
  }

  private formatDateToVietnamTimezone(date: Date): string {
    // Convert to Asia/Ho_Chi_Minh timezone (UTC+7)
    const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);

    // Format: YYYY-MM-DDTHH:mm:ss+07:00
    const year = vietnamTime.getUTCFullYear();
    const month = String(vietnamTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vietnamTime.getUTCDate()).padStart(2, '0');
    const hours = String(vietnamTime.getUTCHours()).padStart(2, '0');
    const minutes = String(vietnamTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(vietnamTime.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
  }
}
