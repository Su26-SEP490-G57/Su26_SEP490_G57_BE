import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PatientNotificationCategory } from '../entities/patient-notification.entity';
import { PatientNotificationResponseDto } from '../dtos/patient-notification.dto';
import {
  CreatePatientNotificationInput,
  PatientNotificationRepository,
} from '../repositories/patient-notification.repository';
import { StatisticsGateway } from '../../statistics/gateways/statistics.gateway';

@Injectable()
export class PatientNotificationService {
  private readonly logger = new Logger(PatientNotificationService.name);

  constructor(
    private readonly repository: PatientNotificationRepository,
    private readonly statisticsGateway: StatisticsGateway,
  ) {}

  /** Ghi/refresh 1 thông báo cho bệnh nhân — gọi từ các service khác (diet-guidance,
   * treatment-order, care-observation, …) bên cạnh việc bắn FCM, để nó xuất hiện lại
   * trong màn "Thông báo hệ thống". Upsert theo (caseId, route): thông báo kiểu
   * "trạng thái hiện tại" (hướng dẫn ăn, phiếu điều trị/chăm sóc mới nhất) chỉ giữ
   * ĐÚNG 1 dòng mới nhất mỗi loại, không tích tụ mỗi lần bác sĩ/điều dưỡng cập nhật —
   * xem ghi chú ở `PatientNotificationRepository.upsertByRoute`. Đồng thời bắn luôn
   * qua socket /statistics để app cập nhật ngay khi đang mở, không cần đợi push (FCM
   * cần APNs/thiết bị thật, không chạy trên simulator — socket thì chạy được ngay cả
   * trên local). Cả ghi DB lẫn bắn socket đều best-effort: lỗi không được làm fail
   * nghiệp vụ gọi nó. */
  async notify(input: CreatePatientNotificationInput): Promise<void> {
    try {
      const saved = await this.repository.upsertByRoute(input);
      this.statisticsGateway.emitNotificationCreated({
        caseId: saved.caseId,
        notificationId: saved.notificationId,
        title: saved.title,
        body: saved.body,
        category: saved.category,
        route: saved.route,
        isRead: saved.isRead,
        createdAt: saved.createdAt,
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist/emit notification for case "${input.caseId}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async listForPatient(
    caseId: string,
    category?: PatientNotificationCategory,
  ): Promise<PatientNotificationResponseDto[]> {
    const notifications = await this.repository.findAllByCaseId(caseId, category);
    return notifications.map((n) => ({
      notificationId: n.notificationId,
      title: n.title,
      body: n.body,
      category: n.category,
      route: n.route,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
  }

  async markAsRead(
    notificationId: number,
    caseId: string,
  ): Promise<PatientNotificationResponseDto> {
    const notification = await this.repository.markAsRead(notificationId, caseId);
    if (!notification) {
      throw new NotFoundException(`Notification #${notificationId} not found`);
    }
    return {
      notificationId: notification.notificationId,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      route: notification.route,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }
}
