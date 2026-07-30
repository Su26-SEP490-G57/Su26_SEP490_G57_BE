import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import { cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    console.log('Sending FCM to:', token);

    const message: admin.messaging.Message = {
      token,
      android: {
        priority: 'high',
        notification: {
          channelId: 'patient_alert_channel',
          priority: 'max',
        },
      },
      notification: {
        title,
        body,
      },
    };

    if (data) {
      message.data = data;
    }

    const messageId = await this.messaging.send(message);
    console.log('Firebase messageId:', messageId);
    return messageId;
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string[]> {
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    const results: string[] = [];

    for (const token of uniqueTokens) {
      const messageId = await this.sendToToken(token, title, body, data);

      results.push(messageId);
    }

    return results;
  }

  onModuleInit() {
    if (admin.apps.length > 0) {
      return;
    }

    const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');

    if (!serviceAccountPath) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured.');
    }

    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount;

    admin.initializeApp({
      credential: cert(serviceAccount),
    });

    //console.log('✅ Firebase Admin initialized');
  }

  get messaging() {
    return admin.messaging();
  }
}
