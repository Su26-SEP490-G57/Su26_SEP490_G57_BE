import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthEducationPodContent } from '../entities/health-education-pod-content.entity';

@Injectable()
export class HealthEducationService {
  constructor(
    @InjectRepository(HealthEducationPodContent)
    private readonly repository: Repository<HealthEducationPodContent>,
  ) {}

  async getPodContent(podDay: number): Promise<HealthEducationPodContent> {
    const content = await this.repository.findOne({
      where: { podDay, isActive: true },
    });
    if (!content) {
      throw new NotFoundException(`Nội dung giáo dục cho POD ${podDay} không tồn tại.`);
    }
    return content;
  }
}
