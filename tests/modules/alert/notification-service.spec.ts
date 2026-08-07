import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { NotificationService } from '../../../src/modules/alert/services/notification.service';
import { FirebaseService } from '../../../src/modules/firebase/services/firebase.service';
import { DeviceService } from '../../../src/modules/firebase/services/device.service';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';

function fcmError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

// Forcing FCM send failures (a stale/invalid token) is not something a real
// Firebase project can be made to do on demand, so this exercises
// NotificationService's fan-out/deactivation branches with mocked
// collaborators rather than an integration test.
describe('NotificationService', () => {
  let firebaseService: DeepMocked<FirebaseService>;
  let deviceService: DeepMocked<DeviceService>;
  let service: NotificationService;

  beforeEach(async () => {
    firebaseService = createMock<FirebaseService>();
    deviceService = createMock<DeviceService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: FirebaseService, useValue: firebaseService },
        { provide: DeviceService, useValue: deviceService },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('sendToNursesSpecific()', () => {
    describe('GIVEN no nurse has an active device token', () => {
      it('THEN should return attempted 0 / sent 0 without calling Firebase', async () => {
        deviceService.findActiveTokensForUserIds.mockResolvedValue([]);

        const result = await service.sendToNursesSpecific([1, 2], 'Title', 'Body');

        expect(result).toEqual({ attempted: 0, sent: 0 });
        expect(firebaseService.sendToToken).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN every token sends successfully', () => {
      it('THEN should return attempted and sent equal to the token count', async () => {
        deviceService.findActiveTokensForUserIds.mockResolvedValue(['token-a', 'token-b']);
        firebaseService.sendToToken.mockResolvedValue('message-id');

        const result = await service.sendToNursesSpecific([1, 2], 'Title', 'Body');

        expect(result).toEqual({ attempted: 2, sent: 2 });
        expect(deviceService.deactivateByToken).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN a token fails with an unregistered-token FCM error', () => {
      it('THEN should deactivate that token and exclude it from the sent count', async () => {
        deviceService.findActiveTokensForUserIds.mockResolvedValue(['stale-token', 'ok-token']);
        firebaseService.sendToToken.mockImplementation((token: string) => {
          if (token === 'stale-token') {
            return Promise.reject(fcmError('messaging/registration-token-not-registered'));
          }
          return Promise.resolve('message-id');
        });

        const result = await service.sendToNursesSpecific([1, 2], 'Title', 'Body');

        expect(result).toEqual({ attempted: 2, sent: 1 });
        expect(deviceService.deactivateByToken).toHaveBeenCalledWith('stale-token');
        expect(deviceService.deactivateByToken).toHaveBeenCalledTimes(1);
      });
    });

    describe('GIVEN a token fails with an error unrelated to token validity', () => {
      it('THEN should not deactivate that token', async () => {
        deviceService.findActiveTokensForUserIds.mockResolvedValue(['flaky-token']);
        firebaseService.sendToToken.mockRejectedValue(fcmError('messaging/internal-error'));

        const result = await service.sendToNursesSpecific([1], 'Title', 'Body');

        expect(result).toEqual({ attempted: 1, sent: 0 });
        expect(deviceService.deactivateByToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('sendToNurses()', () => {
    describe('GIVEN no nurse or head nurse has an active device token', () => {
      it('THEN should return attempted 0 / sent 0 and query the nurse roles', async () => {
        deviceService.findActiveTokensForRoles.mockResolvedValue([]);

        const result = await service.sendToNurses('Title', 'Body');

        expect(result).toEqual({ attempted: 0, sent: 0 });
        expect(deviceService.findActiveTokensForRoles).toHaveBeenCalledWith([
          UserRoleName.NURSE,
          UserRoleName.HEAD_NURSE,
        ]);
        expect(firebaseService.sendToToken).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN a token fails with an invalid-registration-token FCM error', () => {
      it('THEN should deactivate that token', async () => {
        deviceService.findActiveTokensForRoles.mockResolvedValue(['bad-token']);
        firebaseService.sendToToken.mockRejectedValue(
          fcmError('messaging/invalid-registration-token'),
        );

        const result = await service.sendToNurses('Title', 'Body');

        expect(result).toEqual({ attempted: 1, sent: 0 });
        expect(deviceService.deactivateByToken).toHaveBeenCalledWith('bad-token');
      });
    });
  });

  describe('sendToPatients()', () => {
    describe('GIVEN no patient has an active device token', () => {
      it('THEN should return attempted 0 / sent 0 and query the patient role', async () => {
        deviceService.findActiveTokensForRoles.mockResolvedValue([]);

        const result = await service.sendToPatients('Title', 'Body');

        expect(result).toEqual({ attempted: 0, sent: 0 });
        expect(deviceService.findActiveTokensForRoles).toHaveBeenCalledWith([UserRoleName.PATIENT]);
      });
    });

    describe('GIVEN every token sends successfully', () => {
      it('THEN should return attempted and sent equal to the token count', async () => {
        deviceService.findActiveTokensForRoles.mockResolvedValue(['token-a']);
        firebaseService.sendToToken.mockResolvedValue('message-id');

        const result = await service.sendToPatients('Title', 'Body');

        expect(result).toEqual({ attempted: 1, sent: 1 });
      });
    });
  });
});
