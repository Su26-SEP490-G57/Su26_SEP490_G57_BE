import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AssessmentTask } from './entities/assessment-task.entity';
import { AssessmentTaskService } from './services/assessment-task.service';
import { AssessmentTaskSchedulerService } from './services/assessment-task-scheduler.service';
import { Patient } from '../patient/entities/patient.entity';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([AssessmentTask, Patient])],
  providers: [AssessmentTaskService, AssessmentTaskSchedulerService],
  exports: [AssessmentTaskService],
})
export class AssessmentModule {}
