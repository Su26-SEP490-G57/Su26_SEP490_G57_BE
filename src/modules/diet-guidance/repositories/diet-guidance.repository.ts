import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationType } from '../../patient/entities/operation-type.entity';
import { PodProtocol } from '../entities/pod-protocol.entity';

@Injectable()
export class DietGuidanceRepository {
  constructor(
    @InjectRepository(OperationType)
    private readonly opTypeRepo: Repository<OperationType>,
    @InjectRepository(PodProtocol)
    private readonly podRepo: Repository<PodProtocol>,
  ) {}

  // ── Operation Types ──────────────────────────────────────────────────────────

  findAllOperationTypes(): Promise<OperationType[]> {
    return this.opTypeRepo.find({ order: { operation_name: 'ASC' } });
  }

  findOperationTypeById(id: number): Promise<OperationType | null> {
    return this.opTypeRepo.findOne({ where: { operation_type_id: id } });
  }

  saveOperationType(data: Partial<OperationType>): Promise<OperationType> {
    return this.opTypeRepo.save(data as OperationType);
  }

  async deleteOperationType(id: number): Promise<void> {
    await this.opTypeRepo.delete({ operation_type_id: id });
  }

  countPodsByOperationType(operationTypeId: number): Promise<number> {
    return this.podRepo.count({ where: { operation_type_id: operationTypeId } });
  }

  // ── Pod Protocols ────────────────────────────────────────────────────────────

  findPodsByOperationType(operationTypeId: number): Promise<PodProtocol[]> {
    return this.podRepo.find({
      where: { operation_type_id: operationTypeId },
      order: { label: 'ASC' },
    });
  }

  findPodById(podId: number): Promise<PodProtocol | null> {
    return this.podRepo.findOne({ where: { pod_id: podId } });
  }

  savePod(data: Partial<PodProtocol>): Promise<PodProtocol> {
    return this.podRepo.save(data as PodProtocol);
  }

  async deletePod(podId: number): Promise<void> {
    await this.podRepo.delete({ pod_id: podId });
  }
}
