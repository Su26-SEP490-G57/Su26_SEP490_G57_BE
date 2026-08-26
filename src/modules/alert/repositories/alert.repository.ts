import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { QueryAlertDto } from '../dtos/query-alert.dto';
import { Alert } from '../entities/alert.entity';

@Injectable()
export class AlertRepository {
  constructor(
    @InjectRepository(Alert)
    private readonly repo: Repository<Alert>,
  ) {}

  save(alert: Partial<Alert>): Promise<Alert> {
    return this.repo.save(alert as Alert);
  }

  findById(alertId: number): Promise<Alert | null> {
    return this.repo.findOne({ where: { alertId: alertId } });
  }

  findLatestRedAlertByCaseId(caseId: string): Promise<Alert | null> {
    return this.repo.findOne({
      where: { caseId, alertType: 'RED' },
      order: { triggeredAt: 'DESC', alertId: 'DESC' },
    });
  }

  findPendingRedByCaseId(caseId: string): Promise<Alert | null> {
    return this.repo.findOne({
      where: {
        caseId: caseId,
        status: 'PENDING_REVIEW',
        alertType: 'RED',
      },
      order: { triggeredAt: 'DESC', alertId: 'DESC' },
    });
  }

  findHandledRedAwaitingUnlockNotification(before: Date): Promise<Alert[]> {
    return this.repo
      .createQueryBuilder('alert')
      .where('alert.alert_type = :alertType', { alertType: 'RED' })
      .andWhere('alert.status = :status', { status: 'HANDLED' })
      .andWhere('alert.unlock_notified_at IS NULL')
      .andWhere('alert.triggered_at <= :before', { before })
      .getMany();
  }

  findAll(query: QueryAlertDto): Promise<[Alert[], number]> {
    const where: FindOptionsWhere<Alert> = {};

    if (query.caseId) where.caseId = query.caseId;
    if (query.status) where.status = query.status;
    if (query.alertType) where.alertType = query.alertType;

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    return this.repo.findAndCount({
      where,
      order: { triggeredAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
