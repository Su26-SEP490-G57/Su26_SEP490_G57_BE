import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

@Injectable()
export class PatientReminderSchedulerService {
  private readonly logger = new Logger(PatientReminderSchedulerService.name);

  constructor(private readonly notificationService: NotificationService) {}

  //Test reminder cron job
  // @Cron('0 */2 * * * *')
  // async sendTestReminder(): Promise<void> {
  //   await this.sendReminder('test', 'Test message');
  // }

  @Cron('0 0 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendMorningReminder(): Promise<void> {
    await this.sendReminder('08:00', 'Nhắc nhở buổi sáng');
  }

  @Cron('0 0 16 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendAfternoonReminder(): Promise<void> {
    await this.sendReminder('16:00', 'Nhắc nhở buổi chiều');
  }

  private async sendReminder(slot: string, title: string): Promise<void> {
    const result = await this.notificationService.sendToPatients(
      title,
      'Đã đến giờ theo dõi sức khỏe. Vui lòng mở ứng dụng để cập nhật triệu chứng.',
    );

    if (result.attempted === 0) {
      this.logger.warn(`No active patient devices found for ${slot} reminder`);
      return;
    }

    this.logger.log(
      `${slot} reminder sent to ${result.sent}/${result.attempted} patient device(s)`,
    );
  }
}
