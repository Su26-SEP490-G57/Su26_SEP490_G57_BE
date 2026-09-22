import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { UsersModule } from '../user/users.module';
import { NurseController } from './controllers/nurse.controller';
import { NurseGateway } from './gateways/nurse.gateway';
import { NurseRepository } from './repositories/nurse.repository';
import { NurseService } from './services/nurse.service';

import { RoomNurseAssignment } from './entities/room-nurse-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, RoomNurseAssignment]), UsersModule],
  controllers: [NurseController],
  providers: [NurseService, NurseRepository, NurseGateway],
  exports: [NurseService, NurseRepository, NurseGateway],
})
export class NurseModule {}
