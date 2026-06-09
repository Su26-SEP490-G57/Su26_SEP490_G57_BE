import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateSymptomSurveyDto } from '../dtos/create-symptom-survey.dto';
import { SymptomSurveyResponseDto } from '../dtos/symptom-survey-response.dto';
import { SymptomSurveyService } from '../services/symptom-survey.service';

@ApiTags('Symptom Surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('symptom-surveys')
export class SymptomSurveyController {
  constructor(private readonly symptomSurveyService: SymptomSurveyService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a daily symptom survey',
    description:
      'Submit symptom scores for a patient. Auto-calculates total_score and triage_color (GREEN ≤5, YELLOW 6-9, RED ≥10). Auto-generates an alert if triage is YELLOW or RED.',
  })
  @ApiResponse({ status: 201, type: SymptomSurveyResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  submit(@Body() dto: CreateSymptomSurveyDto): Promise<SymptomSurveyResponseDto> {
    return this.symptomSurveyService.submitSurvey(dto);
  }

  @Get(':patientId/latest')
  @ApiOperation({ summary: 'Get latest survey for a patient' })
  @ApiResponse({ status: 200, type: SymptomSurveyResponseDto })
  @ApiNotFoundResponse({ description: 'No survey found for patient' })
  getLatest(@Param('patientId') patientId: string): Promise<SymptomSurveyResponseDto> {
    return this.symptomSurveyService.getLatestByPatient(patientId);
  }

  @Get(':surveyId')
  @ApiOperation({
    summary: 'Get survey by ID',
    description: 'Returns full survey detail including triage recommendation text.',
  })
  @ApiResponse({ status: 200, type: SymptomSurveyResponseDto })
  @ApiNotFoundResponse({ description: 'Survey not found' })
  getById(@Param('surveyId', ParseIntPipe) surveyId: number): Promise<SymptomSurveyResponseDto> {
    return this.symptomSurveyService.getSurveyById(surveyId);
  }
}
