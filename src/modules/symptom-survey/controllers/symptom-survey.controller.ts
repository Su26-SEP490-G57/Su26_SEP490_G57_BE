import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
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
      'Submit answers for each question. BE calculates total_score from option score_values and assigns triage_color (GREEN 0-1, YELLOW 2-3, RED ≥4). Auto-generates alert if YELLOW or RED. Patient role can only submit for their own case_id.',
  })
  @ApiResponse({ status: 201, type: SymptomSurveyResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or invalid option ID' })
  @ApiResponse({ status: 403, description: 'Patient attempting to submit for another case' })
  submit(
    @Body() dto: CreateSymptomSurveyDto,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<SymptomSurveyResponseDto> {
    return this.symptomSurveyService.submitSurvey(dto, caller);
  }

  @Get(':patientId/latest')
  @ApiOperation({
    summary: 'Get latest survey for a patient',
    description: 'Nurse/Admin can view any patient. Patient role can only view their own.',
  })
  @ApiResponse({ status: 200, type: SymptomSurveyResponseDto })
  @ApiNotFoundResponse({ description: 'No survey found for patient' })
  @ApiResponse({ status: 403, description: 'Patient attempting to view another patient survey' })
  getLatest(
    @Param('patientId') patientId: string,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<SymptomSurveyResponseDto> {
    return this.symptomSurveyService.getLatestByPatient(patientId, caller);
  }

  @Get(':surveyId')
  @ApiOperation({
    summary: 'Get survey detail by ID',
    description: 'Returns full answer breakdown and triage recommendation text. Patient role can only view their own surveys.',
  })
  @ApiResponse({ status: 200, type: SymptomSurveyResponseDto })
  @ApiNotFoundResponse({ description: 'Survey not found' })
  @ApiResponse({ status: 403, description: 'Patient attempting to view another patient survey' })
  getById(
    @Param('surveyId', ParseIntPipe) surveyId: number,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<SymptomSurveyResponseDto> {
    return this.symptomSurveyService.getSurveyById(surveyId, caller);
  }
}
