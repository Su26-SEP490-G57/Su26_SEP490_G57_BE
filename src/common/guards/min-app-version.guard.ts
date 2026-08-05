import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { Request } from 'express';

const UPGRADE_REQUIRED = 426;
const DEFAULT_MIN_SUPPORTED_VERSION_CODE = 1;
const VERSION_FILE_PATH = '/app/version.json';

interface VersionFile {
  android?: {
    minSupportedVersionCode?: unknown;
  };
}

@Injectable()
export class MinAppVersionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-app-version-code'];
    const rawVersionCode = Array.isArray(header) ? header[0] : header;

    if (!rawVersionCode) return true;

    const versionCode = Number(rawVersionCode);
    if (!Number.isInteger(versionCode)) return true;

    const minSupportedVersionCode = this.readMinSupportedVersionCode();

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

  // Reads the bind-mounted version.json fresh on every call (no in-memory caching) so the
  // guard reflects whatever the FE's build/version-flags workflows most recently pushed to
  // the VPS, without requiring this app's container to restart.
  private readMinSupportedVersionCode(): number {
    try {
      const raw = readFileSync(VERSION_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as VersionFile;
      const value = parsed.android?.minSupportedVersionCode;

      return typeof value === 'number' && Number.isInteger(value)
        ? value
        : DEFAULT_MIN_SUPPORTED_VERSION_CODE;
    } catch {
      return DEFAULT_MIN_SUPPORTED_VERSION_CODE;
    }
  }
}
