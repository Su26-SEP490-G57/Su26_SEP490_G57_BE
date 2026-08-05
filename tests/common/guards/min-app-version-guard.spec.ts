import { ExecutionContext, HttpException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { readFileSync } from 'fs';
import { MinAppVersionGuard } from '../../../src/common/guards/min-app-version.guard';

jest.mock('fs');

describe('MinAppVersionGuard', () => {
  let guard: MinAppVersionGuard;
  const mockedReadFileSync = readFileSync as jest.Mock;

  function contextWithHeader(versionCode: string | undefined): DeepMocked<ExecutionContext> {
    const context = createMock<ExecutionContext>();
    context.switchToHttp().getRequest.mockReturnValue({
      headers: versionCode === undefined ? {} : { 'x-app-version-code': versionCode },
    });
    return context;
  }

  function mockVersionFile(minSupportedVersionCode: unknown) {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ schemaVersion: 1, android: { minSupportedVersionCode } }),
    );
  }

  beforeEach(() => {
    guard = new MinAppVersionGuard();
    mockedReadFileSync.mockReset();
  });

  describe('canActivate()', () => {
    describe('GIVEN the request has no X-App-Version-Code header', () => {
      it('THEN should allow the request through without reading version.json', () => {
        const result = guard.canActivate(contextWithHeader(undefined));

        expect(result).toBe(true);
        expect(mockedReadFileSync).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN the X-App-Version-Code header is not a valid integer', () => {
      it('THEN should allow the request through', () => {
        const result = guard.canActivate(contextWithHeader('not-a-number'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the header version code is equal to the mounted minSupportedVersionCode', () => {
      it('THEN should allow the request through', () => {
        mockVersionFile(40);

        const result = guard.canActivate(contextWithHeader('40'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the header version code is above the mounted minSupportedVersionCode', () => {
      it('THEN should allow the request through', () => {
        mockVersionFile(40);

        const result = guard.canActivate(contextWithHeader('42'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the header version code is below the mounted minSupportedVersionCode', () => {
      it('THEN should throw a 426 Upgrade Required HttpException', () => {
        mockVersionFile(40);

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

    describe('GIVEN version.json is not mounted (e.g. local development)', () => {
      it('THEN should fall back to a minimum of 1', () => {
        mockedReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        const result = guard.canActivate(contextWithHeader('1'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN version.json contains malformed JSON', () => {
      it('THEN should fall back to a minimum of 1', () => {
        mockedReadFileSync.mockReturnValue('not valid json');

        const result = guard.canActivate(contextWithHeader('1'));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN version.json has a non-numeric minSupportedVersionCode', () => {
      it('THEN should fall back to a minimum of 1', () => {
        mockVersionFile('not-a-number');

        const result = guard.canActivate(contextWithHeader('1'));

        expect(result).toBe(true);
      });
    });
  });
});
