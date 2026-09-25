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

  async markAsRead(notificationId: number, caseId: string): Promise<PatientNotification | null> {
    const notification = await this.findOneByIdAndCaseId(notificationId, caseId);
    if (!notification) return null;
    if (!notification.isRead) {
      notification.isRead = true;
      await this.repo.save(notification);
    }
    return notification;
  }
}
