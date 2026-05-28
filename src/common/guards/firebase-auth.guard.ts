import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-id-token'];

    if (!token) {
      throw new UnauthorizedException('Missing Firebase ID token');
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token as string);
      req.user = decoded;
      return true;
    } catch (err) {
      this.logger.warn(`Firebase token verify failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Firebase ID token');
    }
  }
}
