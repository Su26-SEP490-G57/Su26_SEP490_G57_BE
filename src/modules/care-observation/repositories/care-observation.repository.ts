import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import type { CareLevel } from '../../treatment-order/constants/care-level.constant';
import { CareObservationEntry } from '../entities/care-observation-entry.entity';
import { CareObservationSheetTemplate } from '../entities/care-observation-sheet-template.entity';
import type { CareObservationTemplateCode } from '../entities/care-observation-sheet-template.entity';
import { CareObservationTask } from '../entities/care-observation-task.entity';

/**
 * Thin data-access wrapper. Every write helper accepts an optional
 * `EntityManager` so the treatment-order creation flow can run them inside its
 * transaction (`DataSource.transaction`).
 */
@Injectable()
export class CareObservationRepository {
  constructor(
    @InjectRepository(CareObservationSheetTemplate)
    private readonly templateRepo: Repository<CareObservationSheetTemplate>,
    @InjectRepository(CareObservationTask)
    private readonly taskRepo: Repository<CareObservationTask>,
    @InjectRepository(CareObservationEntry)
    private readonly entryRepo: Repository<CareObservationEntry>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  private templates(manager?: EntityManager): Repository<CareObservationSheetTemplate> {
    return manager ? manager.getRepository(CareObservationSheetTemplate) : this.templateRepo;
  }

  private tasks(manager?: EntityManager): Repository<CareObservationTask> {
    return manager ? manager.getRepository(CareObservationTask) : this.taskRepo;
  }

  private entries(manager?: EntityManager): Repository<CareObservationEntry> {
    return manager ? manager.getRepository(CareObservationEntry) : this.entryRepo;
  }

  async patientExists(caseId: string): Promise<boolean> {
    return (await this.patientRepo.count({ where: { caseId } })) > 0;
  }

  findTemplateByCode(
    code: CareObservationTemplateCode,
    manager?: EntityManager,
  ): Promise<CareObservationSheetTemplate | null> {
    return this.templates(manager).findOne({ where: { code } });
  }

  findOpenTaskByCaseId(
    caseId: string,
    manager?: EntityManager,
  ): Promise<CareObservationTask | null> {
    return this.tasks(manager).findOne({
      where: { caseId, status: 'OPEN' },
      relations: ['template'],
    });
  }

  findTaskById(taskId: number, manager?: EntityManager): Promise<CareObservationTask | null> {
    return this.tasks(manager).findOne({
      where: { taskId },
      relations: ['template'],
    });
  }

  /**
   * Open tasks for every case currently assigned to `nurseUserId`
   * (`patient_cases.assigned_nurse_id`), newest first.
   */
  findOpenTasksForNurse(nurseUserId: number): Promise<CareObservationTask[]> {
    return this.taskRepo
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.template', 'template')
      .innerJoin(Patient, 'patient', 'patient.caseId = task.caseId')
      .where('task.status = :status', { status: 'OPEN' })
      .andWhere('patient.assignedNurse = :nurseUserId', { nurseUserId })
      .andWhere('patient.deletedAt IS NULL')
      .orderBy('task.createdAt', 'DESC')
      .getMany();
  }

  /** All open tasks in the ward (Head Nurse view of `/tasks/mine`). */
  findAllOpenTasks(): Promise<CareObservationTask[]> {
    return this.taskRepo
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.template', 'template')
      .innerJoin(Patient, 'patient', 'patient.caseId = task.caseId')
      .where('task.status = :status', { status: 'OPEN' })
      .andWhere('patient.deletedAt IS NULL')
      .orderBy('task.createdAt', 'DESC')
      .getMany();
  }

  saveTask(
    data: DeepPartial<CareObservationTask>,
    manager?: EntityManager,
  ): Promise<CareObservationTask> {
    return this.tasks(manager).save(data);
  }

  /** Re-point an existing OPEN task at the order that most recently confirmed it. */
  async updateTaskOrderRef(
    taskId: number,
    treatmentOrderId: number,
    careLevelAtAssignment: CareLevel,
    manager?: EntityManager,
  ): Promise<void> {
    await this.tasks(manager).update({ taskId }, { treatmentOrderId, careLevelAtAssignment });
  }

  async markTaskSuperseded(taskId: number, at: Date, manager?: EntityManager): Promise<void> {
    await this.tasks(manager).update({ taskId }, { status: 'SUPERSEDED', supersededAt: at });
  }

  findEntriesByTaskId(taskId: number): Promise<CareObservationEntry[]> {
    return this.entryRepo.find({
      where: { taskId },
      order: { observedAt: 'DESC', entryId: 'DESC' },
    });
  }

  saveEntry(
    data: DeepPartial<CareObservationEntry>,
    manager?: EntityManager,
  ): Promise<CareObservationEntry> {
    return this.entries(manager).save(data);
  }
}
