import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateSymptomSurveyDto } from '../dtos/create-symptom-survey.dto';
import { SurveyQuestionDto, SymptomSurveyResponseDto } from '../dtos/symptom-survey-response.dto';
import { SymptomSurveyService } from '../services/symptom-survey.service';

@ApiTags('Symptom Surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('symptom-surveys')
export class SymptomSurveyController {
  constructor(private readonly symptomSurveyService: SymptomSurveyService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Get all survey questions with options' })
  @ApiResponse({ status: 200, type: [SurveyQuestionDto] })
  getQuestions(): Promise<SurveyQuestionDto[]> {
    return this.symptomSurveyService.getQuestions();
  }

  @Post()
  @ApiOperation({
    summary: 'Submit a daily symptom survey',
    description:
      'Submit answers for each question. BE calculates total_score from option score_values and assigns triage_color (GREEN ≤5, YELLOW 6-9, RED ≥10). Auto-generates alert if YELLOW or RED.',
  })
  @ApiResponse({ status: 201, type: SymptomSurveyResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or invalid option ID' })
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
    summary: 'Get survey detail by ID',
    description: 'Returns full answer breakdown and triage recommendation text.',
  })
  @ApiResponse({ status: 200, type: SymptomSurveyResponseDto })
  @ApiNotFoundResponse({ description: 'Survey not found' })
  getById(@Param('surveyId', ParseIntPipe) surveyId: number): Promise<SymptomSurveyResponseDto> {
    return this.symptomSurveyService.getSurveyById(surveyId);
  }
}
