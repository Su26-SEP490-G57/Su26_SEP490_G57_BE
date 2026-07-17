import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
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
    return this.opTypeRepo.find({ order: { operationName: 'ASC' } });
  }

  findOperationTypeById(id: number): Promise<OperationType | null> {
    return this.opTypeRepo.findOne({ where: { operationTypeId: id } });
  }

  saveOperationType(data: Partial<OperationType>): Promise<OperationType> {
    return this.opTypeRepo.save(data as OperationType);
  }

  async deleteOperationType(id: number): Promise<void> {
    await this.opTypeRepo.delete({ operationTypeId: id });
  }

  countPodsByOperationType(operationTypeId: number): Promise<number> {
    return this.podRepo.count({ where: { operationTypeId: operationTypeId } });
  }

  // ── Pod Protocols ────────────────────────────────────────────────────────────

  findPodsByOperationType(operationTypeId: number): Promise<PodProtocol[]> {
    return this.podRepo.find({
      where: { operationTypeId: operationTypeId },
      order: { label: 'ASC' },
    });
  }

  findPodById(podId: number): Promise<PodProtocol | null> {
    return this.podRepo.findOne({ where: { podId: podId } });
  }

  savePod(data: DeepPartial<PodProtocol>): Promise<PodProtocol> {
    return this.podRepo.save(data);
  }

  async deletePod(podId: number): Promise<void> {
    await this.podRepo.delete({ podId: podId });
  }
}
