import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import type { CareLevel } from '../constants/care-level.constant';
import { TreatmentOrder } from '../entities/treatment-order.entity';

/**
 * Thin data-access wrapper. Write helpers take an optional `EntityManager` so
 * `TreatmentOrderService` can run them inside its transaction.
 */
@Injectable()
export class TreatmentOrderRepository {
  constructor(
    @InjectRepository(TreatmentOrder)
    private readonly repo: Repository<TreatmentOrder>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  private orders(manager?: EntityManager): Repository<TreatmentOrder> {
    return manager ? manager.getRepository(TreatmentOrder) : this.repo;
  }

  private patients(manager?: EntityManager): Repository<Patient> {
    return manager ? manager.getRepository(Patient) : this.patientRepo;
  }

  findPatient(caseId: string, manager?: EntityManager): Promise<Patient | null> {
    return this.patients(manager).findOne({ where: { caseId } });
  }

  findById(treatmentOrderId: number, manager?: EntityManager): Promise<TreatmentOrder | null> {
    return this.orders(manager).findOne({ where: { treatmentOrderId } });
  }

  /** Order history for a case, newest first. */
  findByCaseId(caseId: string): Promise<TreatmentOrder[]> {
    return this.repo.find({
      where: { caseId },
      order: { orderedAt: 'DESC', treatmentOrderId: 'DESC' },
    });
  }

  save(data: DeepPartial<TreatmentOrder>, manager?: EntityManager): Promise<TreatmentOrder> {
    return this.orders(manager).save(data);
  }

  /** Mirror the active order onto the patient case. */
  async setActiveOrderOnPatient(
    caseId: string,
    careLevel: CareLevel,
    treatmentOrderId: number,
    manager?: EntityManager,
  ): Promise<void> {
    await this.patients(manager).update(
      { caseId },
      { activeCareLevel: careLevel, activeTreatmentOrderId: treatmentOrderId },
    );
  }
}
