import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { MinAppVersionGuard } from '../../../src/common/guards/min-app-version.guard';

describe('MinAppVersionGuard', () => {
  let config: DeepMocked<ConfigService>;
  let guard: MinAppVersionGuard;

  function contextWithHeader(versionCode: string | undefined): DeepMocked<ExecutionContext> {
    const context = createMock<ExecutionContext>();
    context.switchToHttp().getRequest.mockReturnValue({
      headers: versionCode === undefined ? {} : { 'x-app-version-code': versionCode },
    });
    return context;
  }

  beforeEach(() => {
    config = createMock<ConfigService>();
    guard = new MinAppVersionGuard(config);
  });

  describe('canActivate()', () => {
    describe('GIVEN the request has no X-App-Version-Code header', () => {
      it('THEN should allow the request through', () => {
        const result = guard.canActivate(contextWithHeader(undefined));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the X-App-Version-Code header is not a valid integer', () => {
      it('THEN should allow the request through', () => {
        const result = guard.canActivate(contextWithHeader('not-a-number'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the header version code is equal to the configured minimum', () => {
      it('THEN should allow the request through', () => {
        config.get.mockReturnValue(40);

        const result = guard.canActivate(contextWithHeader('40'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the header version code is above the configured minimum', () => {
      it('THEN should allow the request through', () => {
        config.get.mockReturnValue(40);

        const result = guard.canActivate(contextWithHeader('42'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the header version code is below the configured minimum', () => {
      it('THEN should throw a 426 Upgrade Required HttpException', () => {
        config.get.mockReturnValue(40);

        expect(() => guard.canActivate(contextWithHeader('39'))).toThrow(HttpException);

        try {
          guard.canActivate(contextWithHeader('39'));
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          const httpError = error as HttpException;
          expect(httpError.getStatus()).toBe(426);
          expect(httpError.getResponse()).toMatchObject({ minSupportedVersionCode: 40 });
        }
      });
    });

    describe('GIVEN MIN_SUPPORTED_VERSION_CODE is not configured', () => {
      it('THEN should fall back to a minimum of 1', () => {
        config.get.mockImplementation((_key: string, defaultValue?: unknown) => defaultValue);

        const result = guard.canActivate(contextWithHeader('1'));

        expect(result).toBe(true);
        expect(config.get).toHaveBeenCalledWith('MIN_SUPPORTED_VERSION_CODE', 1);
      });
    });
  });
});
