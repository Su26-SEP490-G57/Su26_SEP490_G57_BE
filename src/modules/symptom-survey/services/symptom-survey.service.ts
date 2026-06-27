import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertService } from '../../alert/services/alert.service';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRole } from '../../user/enums/user-role.enum';
import { CreateSymptomSurveyDto } from '../dtos/create-symptom-survey.dto';
import { AnswerDetailDto, SurveyQuestionDto, SymptomSurveyResponseDto } from '../dtos/symptom-survey-response.dto';
import { AssessmentDetail } from '../entities/assessment-detail.entity';
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

  async getQuestions(): Promise<SurveyQuestionDto[]> {
    const questions = await this.repository.findAllQuestions();
    return questions.map((q) => ({
      question_id: q.question_id,
      question_text: q.question_text,
      order_number: q.order_number,
      options: q.options.map((o) => ({
        option_id: o.option_id,
        option_text: o.option_text,
        score_value: o.score_value,
      })),
    }));
  }

  async submitSurvey(dto: CreateSymptomSurveyDto): Promise<SymptomSurveyResponseDto> {
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

    // Save assessment header
    const saved = await this.repository.saveSurvey({
      case_id: dto.case_id,
      evaluation_datetime: new Date(),
      pod_context: dto.pod_context ?? null,
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
