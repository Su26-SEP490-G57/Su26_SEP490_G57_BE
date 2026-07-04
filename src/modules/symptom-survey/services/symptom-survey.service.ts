import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertService } from '../../alert/services/alert.service';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRole } from '../../user/enums/user-role.enum';
import { CreateSymptomSurveyDto } from '../dtos/create-symptom-survey.dto';
import {
  CreateQuestionOptionDto,
  CreateSurveyQuestionDto,
  QuestionOptionDto,
  UpdateQuestionOptionDto,
  UpdateSurveyQuestionDto,
} from '../dtos/survey-question.dto';
import { AnswerDetailDto, SurveyQuestionDto, SymptomSurveyResponseDto } from '../dtos/symptom-survey-response.dto';
import { AssessmentDetail } from '../entities/assessment-detail.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { SurveyQuestion } from '../entities/survey-question.entity';
import { SymptomSurvey } from '../entities/symptom-survey.entity';
import { SymptomSurveyRepository } from '../repositories/symptom-survey.repository';

const TRIAGE_RECOMMENDATIONS: Record<string, string> = {
  GREEN: 'Bệnh nhân ổn định. Tiếp tục theo dõi thường quy theo phác đồ ERAS.',
  YELLOW: 'Bệnh nhân có triệu chứng mức độ trung bình. Điều dưỡng cần đánh giá lại và cân nhắc can thiệp.',
  RED: 'Bệnh nhân có triệu chứng nặng. Cần can thiệp y tế ngay lập tức. Thông báo bác sĩ phụ trách.',
};

@Injectable()
export class SymptomSurveyService {
  constructor(
    private readonly repository: SymptomSurveyRepository,
    private readonly alertService: AlertService,
  ) {}

  private calculateTriageColor(totalScore: number): 'GREEN' | 'YELLOW' | 'RED' {
    if (totalScore <= 1) return 'GREEN';
    if (totalScore <= 3) return 'YELLOW';
    return 'RED';
  }

  private toResponse(
    survey: SymptomSurvey,
    details?: AssessmentDetail[],
    includeRecommendation = false,
  ): SymptomSurveyResponseDto {
    const dto: SymptomSurveyResponseDto = {
      assessment_id: survey.assessment_id,
      case_id: survey.case_id,
      evaluation_datetime: survey.evaluation_datetime,
      pod_context: survey.pod_context,
      total_score: survey.total_score,
      triage_color: survey.triage_color,
    };

    if (details && details.length > 0) {
      dto.details = details.map((d): AnswerDetailDto => ({
        question_id: d.question_id,
        question_text: d.question.question_text,
        selected_option_id: d.selected_option_id,
        option_text: d.selected_option.option_text,
        score_earned: d.score_earned,
      }));
    }

    if (includeRecommendation && survey.triage_color) {
      dto.recommendation = TRIAGE_RECOMMENDATIONS[survey.triage_color];
    }

    return dto;
  }

  private toQuestionResponse(question: SurveyQuestion): SurveyQuestionDto {
    return {
      question_id: question.question_id,
      question_text: question.question_text,
      order_number: question.order_number,
      is_default: question.is_default,
      options: (question.options ?? []).map((o) => this.toOptionResponse(o)),
    };
  }

  private toOptionResponse(option: QuestionOption): QuestionOptionDto {
    return {
      option_id: option.option_id,
      option_text: option.option_text,
      score_value: option.score_value,
    };
  }

  async getQuestions(): Promise<SurveyQuestionDto[]> {
    const questions = await this.repository.findAllQuestions();
    return questions.map((q) => this.toQuestionResponse(q));
  }

  async getQuestionById(questionId: number): Promise<SurveyQuestionDto> {
    const question = await this.repository.findQuestionById(questionId);
    if (!question) throw new NotFoundException(`Question #${questionId} not found`);
    return this.toQuestionResponse(question);
  }

  async createQuestion(dto: CreateSurveyQuestionDto): Promise<SurveyQuestionDto> {
    const saved = await this.repository.saveQuestion({
      question_text: dto.question_text,
      order_number: dto.order_number ?? null,
      is_default: dto.is_default,
    });

    if (dto.options?.length) {
      await this.repository.saveOptions(
        dto.options.map((o) => ({
          question_id: saved.question_id,
          option_text: o.option_text,
          score_value: o.score_value,
        })),
      );
    }

    return this.getQuestionById(saved.question_id);
  }

  async updateQuestion(questionId: number, dto: UpdateSurveyQuestionDto): Promise<SurveyQuestionDto> {
    const question = await this.repository.findQuestionById(questionId);
    if (!question) throw new NotFoundException(`Question #${questionId} not found`);

    if (dto.question_text !== undefined) question.question_text = dto.question_text;
    if (dto.order_number !== undefined) question.order_number = dto.order_number;
    if (dto.is_default !== undefined) question.is_default = dto.is_default;

    await this.repository.saveQuestion({
      question_id: question.question_id,
      question_text: question.question_text,
      order_number: question.order_number,
      is_default: question.is_default,
    });
    return this.getQuestionById(questionId);
  }

  async deleteQuestion(questionId: number): Promise<void> {
    const question = await this.repository.findQuestionById(questionId);
    if (!question) throw new NotFoundException(`Question #${questionId} not found`);

    const usedCount = await this.repository.countDetailsByQuestion(questionId);
    if (usedCount > 0) {
      throw new ConflictException(
        `Question #${questionId} has been used in ${usedCount} assessment(s) and cannot be deleted`,
      );
    }
    await this.repository.deleteQuestion(questionId);
  }

  // ── Question Options ───────────────────────────────────────────────────────────

  async addOption(questionId: number, dto: CreateQuestionOptionDto): Promise<QuestionOptionDto> {
    const question = await this.repository.findQuestionById(questionId);
    if (!question) throw new NotFoundException(`Question #${questionId} not found`);

    const saved = await this.repository.saveOption({
      question_id: questionId,
      option_text: dto.option_text,
      score_value: dto.score_value,
    });
    return this.toOptionResponse(saved);
  }

  async updateOption(
    questionId: number,
    optionId: number,
    dto: UpdateQuestionOptionDto,
  ): Promise<QuestionOptionDto> {
    const option = await this.repository.findOptionById(optionId);
    if (!option || option.question_id !== questionId) {
      throw new NotFoundException(`Option #${optionId} not found`);
    }

    if (dto.option_text !== undefined) option.option_text = dto.option_text;
    if (dto.score_value !== undefined) option.score_value = dto.score_value;

    const saved = await this.repository.saveOption(option);
    return this.toOptionResponse(saved);
  }

  async deleteOption(questionId: number, optionId: number): Promise<void> {
    const option = await this.repository.findOptionById(optionId);
    if (!option || option.question_id !== questionId) {
      throw new NotFoundException(`Option #${optionId} not found`);
    }

    const usedCount = await this.repository.countDetailsByOption(optionId);
    if (usedCount > 0) {
      throw new ConflictException(
        `Option #${optionId} has been selected in ${usedCount} assessment(s) and cannot be deleted`,
      );
    }
    await this.repository.deleteOption(optionId);
  }

  async submitSurvey(dto: CreateSymptomSurveyDto, caller: UserResponseDto): Promise<SymptomSurveyResponseDto> {
    if (caller.roles.includes(UserRole.PATIENT) && caller.caseId !== dto.case_id) {
      throw new ForbiddenException('You can only submit surveys for your own case');
    }

    // Load options to get score_value
    const optionIds = dto.answers.map((a) => a.selected_option_id);
    const options = await this.repository.findOptionsByIds(optionIds);
    const optionMap = new Map(options.map((o) => [o.option_id, o]));

    // Validate all options exist
    for (const answer of dto.answers) {
      if (!optionMap.has(answer.selected_option_id)) {
        throw new BadRequestException(`Option ID ${answer.selected_option_id} not found`);
      }
    }

    const totalScore = dto.answers.reduce((sum, answer) => {
      return sum + (optionMap.get(answer.selected_option_id)?.score_value ?? 0);
    }, 0);

    const triage_color = this.calculateTriageColor(totalScore);

    // Resolve current POD from DB — not trusted from client
    const currentPod = await this.repository.findCurrentPod(dto.case_id);

    // Save assessment header
    const saved = await this.repository.saveSurvey({
      case_id: dto.case_id,
      evaluation_datetime: new Date(),
      pod_context: currentPod,
      total_score: totalScore,
      triage_color,
    });

    // Save detail rows
    const detailData = dto.answers.map((answer) => ({
      assessment_id: saved.assessment_id,
      question_id: answer.question_id,
      selected_option_id: answer.selected_option_id,
      score_earned: optionMap.get(answer.selected_option_id)?.score_value ?? 0,
    }));
    await this.repository.saveDetails(detailData);

    // Sync patient level based on latest triage result
    await this.repository.syncPatientLevel(saved.case_id, triage_color);

    // Auto-generate alert for YELLOW or RED
    if (triage_color === 'YELLOW' || triage_color === 'RED') {
      await this.alertService.createAlert({
        caseId: saved.case_id,
        assessmentId: saved.assessment_id,
        surveyScore: saved.total_score,
        alertType: triage_color,
      });
    }

    return this.toResponse(saved);
  }

  async getLatestByPatient(caseId: string, caller: UserResponseDto): Promise<SymptomSurveyResponseDto> {
    if (caller.roles.includes(UserRole.PATIENT) && caller.caseId !== caseId) {
      throw new ForbiddenException('You can only view your own survey results');
    }
    const survey = await this.repository.findLatestByPatient(caseId);
    if (!survey) throw new NotFoundException(`No survey found for patient ${caseId}`);
    return this.toResponse(survey);
  }

  async getSurveyById(assessmentId: number, caller: UserResponseDto): Promise<SymptomSurveyResponseDto> {
    const survey = await this.repository.findById(assessmentId);
    if (!survey) throw new NotFoundException(`Survey #${assessmentId} not found`);
    if (caller.roles.includes(UserRole.PATIENT) && caller.caseId !== survey.case_id) {
      throw new ForbiddenException('You can only view your own survey results');
    }
    const details = await this.repository.findDetailsById(assessmentId);
    return this.toResponse(survey, details, true);
  }
}
