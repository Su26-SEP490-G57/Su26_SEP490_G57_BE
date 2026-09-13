import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthEducationPodContent } from './entities/health-education-pod-content.entity';
import { HealthEducationService } from './services/health-education.service';
import { HealthEducationController } from './controllers/health-education.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HealthEducationPodContent])],
  controllers: [HealthEducationController],
  providers: [HealthEducationService],
  exports: [HealthEducationService],
})
export class HealthEducationModule {}
