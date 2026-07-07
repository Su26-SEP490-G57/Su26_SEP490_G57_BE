import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRole } from '../../user/enums/user-role.enum';
import { CreateSymptomSurveyDto } from '../dtos/create-symptom-survey.dto';
import {
  CreateQuestionOptionDto,
  CreateSurveyQuestionDto,
  QuestionOptionDto,
  UpdateQuestionOptionDto,
  UpdateSurveyQuestionDto,
} from '../dtos/survey-question.dto';
import { SurveyQuestionDto, SymptomSurveyResponseDto } from '../dtos/symptom-survey-response.dto';
import { SymptomSurveyService } from '../services/symptom-survey.service';
import { CurrentUser } from 'src/modules/user/decorators/current-user.decorator';
import { UserResponseDto } from 'src/modules/user/dtos/user-response.dto';

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

  @Get('questions/:questionId')
  @ApiOperation({ summary: 'Get a single survey question with its options' })
  @ApiResponse({ status: 200, type: SurveyQuestionDto })
  @ApiNotFoundResponse({ description: 'Question not found' })
  getQuestion(@Param('questionId', ParseIntPipe) questionId: number): Promise<SurveyQuestionDto> {
    return this.symptomSurveyService.getQuestionById(questionId);
  }

  @Post('questions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
  @ApiOperation({
    summary: 'Create a survey question with optional inline options (Head Nurse only)',
  })
  @ApiResponse({ status: 201, type: SurveyQuestionDto })
  createQuestion(@Body() dto: CreateSurveyQuestionDto): Promise<SurveyQuestionDto> {
    return this.symptomSurveyService.createQuestion(dto);
  }

  @Patch('questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
  @ApiOperation({ summary: 'Update a survey question (Head Nurse only)' })
  @ApiResponse({ status: 200, type: SurveyQuestionDto })
  @ApiNotFoundResponse({ description: 'Question not found' })
  updateQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: UpdateSurveyQuestionDto,
  ): Promise<SurveyQuestionDto> {
    return this.symptomSurveyService.updateQuestion(questionId, dto);
  }

  @Delete('questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a survey question and its options (Head Nurse only)' })
  @ApiResponse({ status: 204 })
  @ApiNotFoundResponse({ description: 'Question not found' })
  @ApiResponse({ status: 409, description: 'Question already used in assessments' })
  deleteQuestion(@Param('questionId', ParseIntPipe) questionId: number): Promise<void> {
    return this.symptomSurveyService.deleteQuestion(questionId);
  }

  @Post('questions/:questionId/options')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
  @ApiOperation({ summary: 'Add an option to a question (Head Nurse only)' })
  @ApiResponse({ status: 201, type: QuestionOptionDto })
  @ApiNotFoundResponse({ description: 'Question not found' })
  addOption(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: CreateQuestionOptionDto,
  ): Promise<QuestionOptionDto> {
    return this.symptomSurveyService.addOption(questionId, dto);
  }

  @Patch('questions/:questionId/options/:optionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
  @ApiOperation({ summary: 'Update a question option (Head Nurse only)' })
  @ApiResponse({ status: 200, type: QuestionOptionDto })
  @ApiNotFoundResponse({ description: 'Option not found' })
  updateOption(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: UpdateQuestionOptionDto,
  ): Promise<QuestionOptionDto> {
    return this.symptomSurveyService.updateOption(questionId, optionId, dto);
  }

  @Delete('questions/:questionId/options/:optionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a question option (Head Nurse only)' })
  @ApiResponse({ status: 204 })
  @ApiNotFoundResponse({ description: 'Option not found' })
  @ApiResponse({ status: 409, description: 'Option already used in assessments' })
  deleteOption(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Param('optionId', ParseIntPipe) optionId: number,
  ): Promise<void> {
    return this.symptomSurveyService.deleteOption(questionId, optionId);
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
    description:
      'Returns full answer breakdown and triage recommendation text. Patient role can only view their own surveys.',
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
