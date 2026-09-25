import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { DiseaseDto, QueryDiseaseDto } from '../dtos/query-disease.dto';
import { DiseaseService } from '../services/disease.service';

@ApiTags('Diseases')
@ApiBearerAuth()
@Controller('diseases')
export class DiseaseController {
  constructor(private readonly diseaseService: DiseaseService) {}

  @Get()
  @Roles(UserRoleName.ADMIN, UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.DOCTOR)
  @ApiOperation({ summary: 'Tra cứu danh mục mã bệnh ICD-10 (Chẩn đoán / Bệnh kèm theo)' })
  @ApiResponse({ status: 200, type: [DiseaseDto] })
  search(@Query() query: QueryDiseaseDto): Promise<DiseaseDto[]> {
    return this.diseaseService.search(query.search, query.limit);
  }
}
