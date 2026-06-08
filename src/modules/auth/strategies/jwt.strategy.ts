import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../user/services/users.service';
import { UserStatus } from '../../user/enums/user-status.enum';
import { UserResponseDto } from 'src/modules/user/dtos/user-response.dto';

export interface JwtPayload {
  sub: number;   // user id
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) throw new UnauthorizedException();
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    return user;
  }
}