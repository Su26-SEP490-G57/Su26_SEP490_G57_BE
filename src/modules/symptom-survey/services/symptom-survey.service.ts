import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertService } from '../../alert/services/alert.service';
import { CreateSymptomSurveyDto } from '../dtos/create-symptom-survey.dto';
import { SymptomSurveyResponseDto } from '../dtos/symptom-survey-response.dto';
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

  private toResponse(survey: SymptomSurvey, includeRecommendation = false): SymptomSurveyResponseDto {
    const dto: SymptomSurveyResponseDto = {
      assessment_id: survey.assessment_id,
      case_id: survey.case_id,
      evaluation_datetime: survey.evaluation_datetime,
      pod_context: survey.pod_context,
      shift_period: survey.shift_period,
      nausea_score: survey.nausea_score,
      vomiting_score: survey.vomiting_score,
      bloating_score: survey.bloating_score,
      intake_volume: survey.intake_volume,
      is_flatus: survey.is_flatus,
      total_score: survey.total_score,
      triage_color: survey.triage_color,
    };

    if (includeRecommendation && survey.triage_color) {
      dto.recommendation = TRIAGE_RECOMMENDATIONS[survey.triage_color];
    }

    return dto;
  }

  private calculateTriageColor(totalScore: number): 'GREEN' | 'YELLOW' | 'RED' {
    if (totalScore <= 5) return 'GREEN';
    if (totalScore <= 9) return 'YELLOW';
    return 'RED';
  }

  async submitSurvey(dto: CreateSymptomSurveyDto): Promise<SymptomSurveyResponseDto> {
    const totalScore = dto.nausea_score + dto.vomiting_score + dto.bloating_score;
    const triage_color = this.calculateTriageColor(totalScore);

    const saved = await this.repository.save({
      case_id: dto.case_id,
      evaluation_datetime: new Date(),
      pod_context: dto.pod_context ?? null,
      shift_period: dto.shift_period ?? null,
      nausea_score: dto.nausea_score,
      vomiting_score: dto.vomiting_score,
      bloating_score: dto.bloating_score,
      intake_volume: dto.intake_volume ?? null,
      is_flatus: dto.is_flatus ?? null,
      total_score: totalScore,
      triage_color,
    });

    // Auto-generate alert for YELLOW or RED triage
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

  async getLatestByPatient(caseId: string): Promise<SymptomSurveyResponseDto> {
    const survey = await this.repository.findLatestByPatient(caseId);
    if (!survey) throw new NotFoundException(`No survey found for patient ${caseId}`);
    return this.toResponse(survey);
  }

  async getSurveyById(assessmentId: number): Promise<SymptomSurveyResponseDto> {
    const survey = await this.repository.findById(assessmentId);
    if (!survey) throw new NotFoundException(`Survey #${assessmentId} not found`);
    return this.toResponse(survey, true);
  }
}
