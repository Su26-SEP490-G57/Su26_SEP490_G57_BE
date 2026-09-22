import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YellowReminderService } from './services/yellow-reminder.service';
import { YellowReminderProcessor } from './processors/yellow-reminder.processor';
import { Alert } from '../alert/entities/alert.entity';
import { AlertModule } from '../alert/alert.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'yellow-reminder' }),
    TypeOrmModule.forFeature([Alert]),
    forwardRef(() => AlertModule),
  ],
  providers: [YellowReminderService, YellowReminderProcessor],
  exports: [YellowReminderService],
})
export class YellowReminderModule {}
