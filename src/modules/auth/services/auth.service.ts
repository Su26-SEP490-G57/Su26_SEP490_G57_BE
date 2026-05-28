import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { User } from '../../../database/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { LoginDto } from '../dtos/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async login(dto: LoginDto): Promise<User> {
    const { idToken } = dto;

    // verify the Firebase ID token
    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      this.logger.warn(`Firebase token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }

    const { uid, email, name } = decodedToken;

    if (!email) {
      throw new UnauthorizedException('Firebase token must contain an email');
    }

    // find existing user or create new one
    let user = await this.userRepository.findOne({
      where: { username: email },
    });

    if (!user) {
      this.logger.log(`Creating new user for Firebase UID: ${uid}`);
      user = this.userRepository.create({
        username: email,
        password_hash: '',
        full_name: name ?? email,
        role: UserRole.NURSE, // default role
        status: UserStatus.ACTIVE,
      });
      await this.userRepository.save(user);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is disabled');
    }

    return user;
  }

  async getMe(firebaseUid: string): Promise<User> {
    // Note: users are identified by their email stored in `username` in this schema.
    const user = await this.userRepository.findOne({
      where: { username: firebaseUid },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}