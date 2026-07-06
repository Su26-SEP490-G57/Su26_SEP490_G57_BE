import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UsersService } from '../../user/services/users.service';
import { LoginDto } from '../dtos/login.dto';
import { RefreshToken } from '../entities/refresh-token.entity';
import { JwtPayload } from '../interface/jwt-payload.interface';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'refresh-change-me';
const ACCESS_EXPIRES = '8h';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByUsername(dto.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roleNames = (user.roles ?? []).map((r) => r.roleName);

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles: roleNames,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: JWT_ACCESS_SECRET,
      expiresIn: ACCESS_EXPIRES,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    // Persist refresh token
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        user_id: user.id,
        token: refreshToken,
        expires_at: expiresAt,
      }),
    );

    const userDto: UserResponseDto = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      caseId: user.case_id ?? null,
      roles: roleNames,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    return { accessToken, refreshToken, user: userDto };
  }

  async refresh(token: string): Promise<{ accessToken: string }> {
    // 1. Verify signature & expiry
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { secret: JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Check token exists in DB (rotation / revocation support)
    const stored = await this.refreshTokenRepo.findOne({ where: { token } });
    if (!stored || stored.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    // 3. Issue new access token
    const newPayload: JwtPayload = {
      sub: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
    const accessToken = this.jwtService.sign(newPayload, {
      secret: JWT_ACCESS_SECRET,
      expiresIn: ACCESS_EXPIRES,
    });

    return { accessToken };
  }

  async logout(token: string): Promise<void> {
    await this.refreshTokenRepo.delete({ token });
  }
}
