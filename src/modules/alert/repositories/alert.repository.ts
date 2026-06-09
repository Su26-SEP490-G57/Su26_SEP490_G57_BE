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
    return this.repo.findOne({ where: { alert_id: alertId } });
  }

  findAll(query: QueryAlertDto): Promise<[Alert[], number]> {
    const where: FindOptionsWhere<Alert> = {};

    if (query.caseId) where.case_id = query.caseId;
    if (query.status) where.status = query.status;
    if (query.alertType) where.alert_type = query.alertType;

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    return this.repo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
