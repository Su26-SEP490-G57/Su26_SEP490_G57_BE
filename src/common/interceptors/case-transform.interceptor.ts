import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor to transform all snake_case keys in response to camelCase
 * for REST API consistency. Database columns remain snake_case.
 */
@Injectable()
export class CaseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return next.handle().pipe(map((data) => this.transformKeys(data)));
  }

  private transformKeys(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle Date objects
    if (obj instanceof Date) {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return obj.map((item) => this.transformKeys(item));
    }

    // Handle plain objects
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof obj === 'object' && obj.constructor === Object) {
      const transformed: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const camelKey = this.toCamelCase(key);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          transformed[camelKey] = this.transformKeys(obj[key]);
        }
      }
      return transformed;
    }

    return obj;
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }
}
