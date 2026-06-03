import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../../user/services/users.service';
import { UserStatus } from '../../user/enums/user-status.enum';
import { LoginDto } from '../dtos/login.dto';
import { JwtPayload } from '../interface/jwt-payload.interface';
import { UserResponseDto } from '../../user/dtos/user-response.dto';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByUsername(dto.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is disabled');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password_hash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET ?? 'change-me',
      expiresIn: '8h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'refresh-change-me',
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
      },
    };
  }

  async getMe(userId: number): Promise<UserResponseDto> {
    return this.usersService.findOne(userId);
  }
}
