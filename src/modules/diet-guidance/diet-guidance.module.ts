import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationType } from '../patient/entities/operation-type.entity';
import { DietGuidanceController } from './controllers/diet-guidance.controller';
import { PodProtocol } from './entities/pod-protocol.entity';
import { DietGuidanceRepository } from './repositories/diet-guidance.repository';
import { DietGuidanceService } from './services/diet-guidance.service';

@Module({
  imports: [TypeOrmModule.forFeature([PodProtocol, OperationType])],
  controllers: [DietGuidanceController],
  providers: [DietGuidanceService, DietGuidanceRepository],
})
export class DietGuidanceModule {}
