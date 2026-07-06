import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { UsersRepository } from './repositories/users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission, RefreshToken])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
