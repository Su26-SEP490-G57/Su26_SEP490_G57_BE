import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentTask } from './entities/assessment-task.entity';
import { AssessmentTaskService } from './services/assessment-task.service';
import { Patient } from '../patient/entities/patient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AssessmentTask, Patient])],
  providers: [AssessmentTaskService],
  exports: [AssessmentTaskService],
})
export class AssessmentModule {}
