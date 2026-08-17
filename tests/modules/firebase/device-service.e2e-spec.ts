import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { DeviceService } from '../../../src/modules/firebase/services/device.service';
import { UserDevice } from '../../../src/modules/firebase/entities/device.entity';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// findActiveTokensForUserIds is a query-builder method (IN clause + isActive
// filter + DISTINCT), so it's exercised against a real DB rather than mocked —
// mocking the repository here would only prove the method calls a function,
// not that the query itself is correct. It's used internally by
// NotificationService#sendToNursesSpecific (see notification-service.spec.ts,
// which mocks DeviceService entirely and so never exercises this query).
describe('DeviceService (integration)', () => {
  let app: INestApplication;
  let deviceService: DeviceService;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await getTestDataSource();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    deviceService = app.get(DeviceService);
  });

  beforeEach(async () => {
    await resetTestDataSource();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('findActiveTokensForUserIds()', () => {
    describe('GIVEN an empty array of user ids', () => {
      it('THEN should return an empty array', async () => {
        const result = await deviceService.findActiveTokensForUserIds([]);

        expect(result).toEqual([]);
      });
    });

    describe('GIVEN active devices for the requested ids, an inactive device for a requested id, and an active device for a user id not requested', () => {
      it('THEN should return only the active tokens belonging to the requested ids', async () => {
        // user ids 1 (admin), 2 (head_nurse), 3 (nurse01) come from seed.ts.
        await dataSource.getRepository(UserDevice).save([
          { userId: 2, fcmToken: 'token-head-nurse', isActive: true },
          { userId: 3, fcmToken: 'token-nurse01', isActive: true },
          { userId: 3, fcmToken: 'token-nurse01-inactive', isActive: false },
          { userId: 1, fcmToken: 'token-admin-not-requested', isActive: true },
        ]);

        const result = await deviceService.findActiveTokensForUserIds([2, 3]);

        expect(result.sort()).toEqual(['token-head-nurse', 'token-nurse01']);
      });
    });
  });
});
