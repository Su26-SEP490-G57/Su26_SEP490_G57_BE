import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/services/firebase.service';
import { DeviceService } from '../../firebase/services/device.service';
import { UserRoleName } from '../../user/enums/user-role.enum';

@Injectable()
export class NotificationService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly deviceService: DeviceService,
  ) {}

  async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    return this.firebaseService.sendToToken(token, title, body, data);
  }

  async sendToNurses(
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ attempted: number; sent: number }> {
    const tokens = await this.deviceService.findActiveTokensForRoles([
      UserRoleName.NURSE,
      UserRoleName.HEAD_NURSE,
    ]);

    if (!tokens.length) {
      return { attempted: 0, sent: 0 };
    }

    const settled = await Promise.allSettled(
      tokens.map((token) => this.firebaseService.sendToToken(token, title, body, data)),
    );

    await Promise.all(
      settled.map(async (result, index) => {
        if (result.status !== 'rejected') {
          return;
        }

        const reason = result.reason as { code?: string };
        if (
          reason?.code === 'messaging/registration-token-not-registered' ||
          reason?.code === 'messaging/invalid-registration-token'
        ) {
          await this.deviceService.deactivateByToken(tokens[index]);
        }
      }),
    );

    return {
      attempted: tokens.length,
      sent: settled.filter((result) => result.status === 'fulfilled').length,
    };
  }

  async sendToNursesSpecific(
    nurseIds: number[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ attempted: number; sent: number }> {
    const tokens = await this.deviceService.findActiveTokensForUserIds(nurseIds);

    if (!tokens.length) {
      return { attempted: 0, sent: 0 };
    }

    const settled = await Promise.allSettled(
      tokens.map((token) => this.firebaseService.sendToToken(token, title, body, data)),
    );

    await Promise.all(
      settled.map(async (result, index) => {
        if (result.status !== 'rejected') {
          return;
        }

        const reason = result.reason as { code?: string };
        if (
          reason?.code === 'messaging/registration-token-not-registered' ||
          reason?.code === 'messaging/invalid-registration-token'
        ) {
          await this.deviceService.deactivateByToken(tokens[index]);
        }
      }),
    );

    return {
      attempted: tokens.length,
      sent: settled.filter((result) => result.status === 'fulfilled').length,
    };
  }

  async sendToPatientCase(
    caseId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ attempted: number; sent: number }> {
    const tokens = await this.deviceService.findActiveTokensForPatientCase(caseId);

    if (!tokens.length) {
      return { attempted: 0, sent: 0 };
    }

    const settled = await Promise.allSettled(
      tokens.map((token) => this.firebaseService.sendToToken(token, title, body, data)),
    );

    await Promise.all(
      settled.map(async (result, index) => {
        if (result.status !== 'rejected') {
          return;
        }

        const reason = result.reason as { code?: string };
        if (
          reason?.code === 'messaging/registration-token-not-registered' ||
          reason?.code === 'messaging/invalid-registration-token'
        ) {
          await this.deviceService.deactivateByToken(tokens[index]);
        }
      }),
    );

    return {
      attempted: tokens.length,
      sent: settled.filter((result) => result.status === 'fulfilled').length,
    };
  }

  async sendToPatients(
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ attempted: number; sent: number }> {
    const tokens = await this.deviceService.findActiveTokensForRoles([UserRoleName.PATIENT]);

    if (!tokens.length) {
      return { attempted: 0, sent: 0 };
    }

    const settled = await Promise.allSettled(
      tokens.map((token) => this.firebaseService.sendToToken(token, title, body, data)),
    );

    await Promise.all(
      settled.map(async (result, index) => {
        if (result.status !== 'rejected') {
          return;
        }

        const reason = result.reason as { code?: string };
        if (
          reason?.code === 'messaging/registration-token-not-registered' ||
          reason?.code === 'messaging/invalid-registration-token'
        ) {
          await this.deviceService.deactivateByToken(tokens[index]);
        }
      }),
    );

    return {
      attempted: tokens.length,
      sent: settled.filter((result) => result.status === 'fulfilled').length,
    };
  }
}
