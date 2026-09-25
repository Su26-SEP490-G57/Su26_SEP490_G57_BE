import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PatientNotification,
  PatientNotificationCategory,
} from '../entities/patient-notification.entity';

export interface CreatePatientNotificationInput {
  caseId: string;
  title: string;
  body: string;
  category: PatientNotificationCategory;
  route?: string | null;
}

@Injectable()
export class PatientNotificationRepository {
  constructor(
    @InjectRepository(PatientNotification)
    private readonly repo: Repository<PatientNotification>,
  ) {}

  create(input: CreatePatientNotificationInput): Promise<PatientNotification> {
    return this.repo.save(this.repo.create(input));
  }

  /** Upsert by (caseId, route): status-style notifications (current diet guidance,
   * latest treatment/care sheet, …) should show as a single, always-current entry
   * instead of piling up one row per event. Refreshes content + createdAt + isRead
   * so it re-sorts to the top and reads as new again. Falls back to a plain insert
   * when there's no route to key on. */
  async upsertByRoute(input: CreatePatientNotificationInput): Promise<PatientNotification> {
    if (!input.route) {
      return this.create(input);
    }

    const existing = await this.repo.findOne({
      where: { caseId: input.caseId, route: input.route },
    });

    if (!existing) {
      return this.create(input);
    }

    existing.title = input.title;
    existing.body = input.body;
    existing.category = input.category;
    existing.isRead = false;
    existing.createdAt = new Date();
    return this.repo.save(existing);
  }

  findAllByCaseId(
    caseId: string,
    category?: PatientNotificationCategory,
  ): Promise<PatientNotification[]> {
    return this.repo.find({
      where: category ? { caseId, category } : { caseId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  findOneByIdAndCaseId(
    notificationId: number,
    caseId: string,
  ): Promise<PatientNotification | null> {
    return this.repo.findOne({ where: { notificationId, caseId } });
  }

  /** "Đã đọc" cho thông báo kiểu trạng thái (có route: hướng dẫn ăn, phiếu điều trị/
   * chăm sóc mới nhất, …) nghĩa là XEM XONG THÌ MẤT HẲN — không giữ lịch sử. Lần sau
   * có thay đổi mới, `upsertByRoute` sẽ tạo lại một dòng mới vì dòng cũ đã bị xoá.
   * Thông báo không có route (không đi qua upsertByRoute) thì vẫn giữ lại, chỉ đổi
   * cờ isRead — chỗ này chừa cho một loại thông báo lịch sử thật sự trong tương lai. */
  async markAsRead(notificationId: number, caseId: string): Promise<PatientNotification | null> {
    const notification = await this.findOneByIdAndCaseId(notificationId, caseId);
    if (!notification) return null;

    if (notification.route) {
      await this.repo.delete({ notificationId, caseId });
      return { ...notification, isRead: true };
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await this.repo.save(notification);
    }
    return notification;
  }
}
