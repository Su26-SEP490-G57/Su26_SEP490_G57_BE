import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { HealthEducationService } from '../services/health-education.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthEducationPodContent } from '../entities/health-education-pod-content.entity';

@ApiTags('Health Education')
@Controller('health-education')
export class HealthEducationController {
  constructor(private readonly service: HealthEducationService) {}

  @Get('pod/:podDay')
  @ApiOperation({ summary: 'Lấy nội dung giáo dục sức khỏe theo POD' })
  @ApiResponse({
    status: 200,
    description: 'Trả về nội dung thành công',
    type: HealthEducationPodContent,
  })
  async getPodContent(@Param('podDay', ParseIntPipe) podDay: number) {
    return this.service.getPodContent(podDay);
  }
}
