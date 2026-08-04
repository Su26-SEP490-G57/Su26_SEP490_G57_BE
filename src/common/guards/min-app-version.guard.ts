import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const UPGRADE_REQUIRED = 426;

@Injectable()
export class MinAppVersionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-app-version-code'];
    const rawVersionCode = Array.isArray(header) ? header[0] : header;

    if (!rawVersionCode) return true;

    const versionCode = Number(rawVersionCode);
    if (!Number.isInteger(versionCode)) return true;

    const minSupportedVersionCode = this.config.get<number>('MIN_SUPPORTED_VERSION_CODE', 1);

    if (versionCode < minSupportedVersionCode) {
      throw new HttpException(
        {
          statusCode: UPGRADE_REQUIRED,
          error: 'Upgrade Required',
          message: 'This app version is no longer supported. Please update to continue.',
          minSupportedVersionCode,
        },
        UPGRADE_REQUIRED,
      );
    }

    return true;
  }
}
