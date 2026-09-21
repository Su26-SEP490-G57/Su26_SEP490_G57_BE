import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { CareLevel } from '../../treatment-order/constants/care-level.constant';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRoleName } from '../../user/enums/user-role.enum';
import {
  CareObservationEntryResponseDto,
  CareObservationTaskDetailDto,
  CareObservationTaskResponseDto,
  CreateCareObservationEntryDto,
} from '../dtos/care-observation.dto';
import { CareObservationEntry } from '../entities/care-observation-entry.entity';
import type { CareObservationTemplateCode } from '../entities/care-observation-sheet-template.entity';
import { CareObservationTask } from '../entities/care-observation-task.entity';
import { CareObservationRepository } from '../repositories/care-observation.repository';

@Injectable()
export class CareObservationService {
  constructor(private readonly repository: CareObservationRepository) {}

  /** Level 2 and Level 3 deliberately share a single sheet (per the ticket). */
  private templateCodeForCareLevel(careLevel: CareLevel): CareObservationTemplateCode {
    return careLevel === 'LEVEL_1' ? 'LEVEL_1_SHEET' : 'LEVEL_2_3_SHEET';
  }

  /**
   * Auto-assign the Care Observation Sheet matching a newly ordered care level.
   *
   * Called by `TreatmentOrderService` from inside its transaction (hence the
   * `manager` parameter). If the patient's current OPEN task already uses the
   * resolved template (e.g. a LEVEL_2 → LEVEL_3 change), the task and its
   * accumulated entries are left untouched; otherwise the open task is marked
   * SUPERSEDED and a fresh OPEN task is created.
   */
  async assignSheetForCareLevel(
    caseId: string,
    careLevel: CareLevel,
    treatmentOrderId: number,
    manager?: EntityManager,
  ): Promise<CareObservationTask> {
    const code = this.templateCodeForCareLevel(careLevel);
    const template = await this.repository.findTemplateByCode(code, manager);
    if (!template) {
      throw new NotFoundException(
        `Care observation sheet template ${code} is missing — run the database migrations`,
      );
    }

    const openTask = await this.repository.findOpenTaskByCaseId(caseId, manager);
    if (openTask && openTask.templateId === template.templateId) {
      // Same sheet applies — keep the existing task (and its entries) alive,
      // only re-point it at the order that most recently confirmed it.
      await this.repository.updateTaskOrderRef(
        openTask.taskId,
        treatmentOrderId,
        careLevel,
        manager,
      );
      openTask.treatmentOrderId = treatmentOrderId;
      openTask.careLevelAtAssignment = careLevel;
      return openTask;
    }

    if (openTask) {
      await this.repository.markTaskSuperseded(openTask.taskId, new Date(), manager);
    }

    return this.repository.saveTask(
      {
        caseId,
        templateId: template.templateId,
        treatmentOrderId,
        careLevelAtAssignment: careLevel,
        status: 'OPEN',
      },
      manager,
    );
  }

  /**
   * Open sheets for the caller's own patients. Nurses are scoped to the cases
   * whose `patient_cases.assigned_nurse_id` is theirs; a Head Nurse (who
   * supervises the ward rather than individual beds) sees every open sheet.
   */
  async getMyTasks(user: UserResponseDto): Promise<CareObservationTaskResponseDto[]> {
    const isHeadNurse = user.roles?.includes(UserRoleName.HEAD_NURSE);
    const tasks = isHeadNurse
      ? await this.repository.findAllOpenTasks()
      : await this.repository.findOpenTasksForNurse(user.id);

    return tasks.map((task) => this.toTaskResponse(task));
  }

  async getTaskForPatient(caseId: string): Promise<CareObservationTaskResponseDto | null> {
    if (!(await this.repository.patientExists(caseId))) {
      throw new NotFoundException(`Patient case ${caseId} not found`);
    }

    const task = await this.repository.findOpenTaskByCaseId(caseId);
    return task ? this.toTaskResponse(task) : null;
  }

  async getTaskDetail(taskId: number): Promise<CareObservationTaskDetailDto> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`Care observation task ${taskId} not found`);
    }

    const entries = await this.repository.findEntriesByTaskId(taskId);
    return {
      ...this.toTaskResponse(task),
      entries: entries.map((entry) => this.toEntryResponse(entry)),
    };
  }

  async addEntry(
    taskId: number,
    dto: CreateCareObservationEntryDto,
    actor: UserResponseDto,
  ): Promise<CareObservationEntryResponseDto> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`Care observation task ${taskId} not found`);
    }
    if (task.status !== 'OPEN') {
      throw new BadRequestException(
        `Care observation task ${taskId} is ${task.status} and no longer accepts entries`,
      );
    }

    // Observer identity and timestamp are server-derived, never client-supplied.
    const saved = await this.repository.saveEntry({
      taskId,
      findings: dto.findings,
      note: dto.note ?? null,
      observedByUserId: actor.id,
      observedByName: actor.fullName,
    });

    return this.toEntryResponse(saved);
  }

  private toTaskResponse(task: CareObservationTask): CareObservationTaskResponseDto {
    return {
      taskId: task.taskId,
      caseId: task.caseId,
      treatmentOrderId: task.treatmentOrderId ?? null,
      careLevelAtAssignment: task.careLevelAtAssignment,
      status: task.status,
      createdAt: task.createdAt,
      supersededAt: task.supersededAt ?? null,
      template: {
        templateId: task.template.templateId,
        code: task.template.code,
        name: task.template.name,
        checklistItems: task.template.checklistItems ?? [],
      },
    };
  }

  private toEntryResponse(entry: CareObservationEntry): CareObservationEntryResponseDto {
    return {
      entryId: entry.entryId,
      taskId: entry.taskId,
      findings: entry.findings ?? {},
      note: entry.note ?? null,
      observedByUserId: entry.observedByUserId ?? null,
      observedByName: entry.observedByName,
      observedAt: entry.observedAt,
    };
  }
}
