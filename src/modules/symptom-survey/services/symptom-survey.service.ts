import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertService } from '../../alert/services/alert.service';
import { StatisticsGateway } from '../../statistics/gateways/statistics.gateway';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../constants/questionnaire-version.constant';
import { CreateSymptomSurveyDto } from '../dtos/create-symptom-survey.dto';
import {
  CreateQuestionOptionDto,
  CreateSurveyQuestionDto,
  QuestionOptionDto,
  UpdateQuestionOptionDto,
  UpdateSurveyQuestionDto,
} from '../dtos/survey-question.dto';
import {
  AnswerDetailDto,
  AssessmentHistoryItemDto,
  PaginatedAssessmentHistoryDto,
  PatientPodTimelineResponseDto,
  PodHistoryItemDto,
  SurveyQuestionDto,
  SymptomSurveyResponseDto,
} from '../dtos/symptom-survey-response.dto';
import { AssessmentDetail } from '../entities/assessment-detail.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { SurveyQuestion } from '../entities/survey-question.entity';
import { SymptomSurvey } from '../entities/symptom-survey.entity';
import { SymptomSurveyRepository } from '../repositories/symptom-survey.repository';
import { AssessmentTaskRepository } from '../repositories/assessment-task.repository';

const TRIAGE_RECOMMENDATIONS: Record<string, string> = {
  GREEN: 'Bệnh nhân ổn định. Tiếp tục theo dõi thường quy theo phác đồ ERAS.',
  YELLOW:
    'Bệnh nhân có triệu chứng mức độ trung bình. Điều dưỡng cần đánh giá lại và cân nhắc can thiệp.',
  RED: 'Bệnh nhân có triệu chứng nặng. Cần can thiệp y tế ngay lập tức. Thông báo bác sĩ phụ trách.',
};

@Injectable()
export class SymptomSurveyService {
  constructor(
    private readonly repository: SymptomSurveyRepository,
    private readonly alertService: AlertService,
    private readonly statisticsGateway: StatisticsGateway,
    private readonly taskRepository: AssessmentTaskRepository,
  ) {}

  // MỚI: Thuật toán Triage biên lâm sàng (không dùng score)
  private resolveNewTriageColor(options: QuestionOption[]): {
    triageColor: 'GREEN' | 'YELLOW' | 'RED';
    triggers: string[];
  } {
    const triggers: string[] = [];

    // Kiểm tra RED/YELLOW theo option level
    const hasRed = options.some((o) => o.optionTriageLevel === 'RED');
    const hasYellow = options.some((o) => o.optionTriageLevel === 'YELLOW');

    if (hasRed) triggers.push('RED_OPTION_SELECTED');

    // Logic Triage cơ bản
    let color: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (hasRed) color = 'RED';
    else if (hasYellow) color = 'YELLOW';

    return { triageColor: color, triggers };
  }

  private toResponse(
    survey: SymptomSurvey,
    details?: AssessmentDetail[],
    includeRecommendation = false,
  ): SymptomSurveyResponseDto {
    const dto: SymptomSurveyResponseDto = {
      assessmentId: survey.assessmentId,
      caseId: survey.caseId,
      evaluationDatetime: survey.evaluationDatetime,
      podContext: survey.podContext,
      totalScore: survey.totalScore, // Tương thích ngược
      triageColor: survey.triageColor,
    };

    if (details && details.length > 0) {
      dto.details = details.map(
        (d): AnswerDetailDto => ({
          questionId: d.questionId,
          questionText: d.questionTextSnapshot, // Sử dụng snapshot
          selectedOptionId: d.selectedOptionId,
          optionText: d.optionTextSnapshot, // Sử dụng snapshot
          scoreEarned: d.scoreEarned,
        }),
      );
    }

    if (includeRecommendation && survey.triageColor) {
      dto.recommendation = TRIAGE_RECOMMENDATIONS[survey.triageColor];
    }

    return dto;
  }

  private toQuestionResponse(question: SurveyQuestion): SurveyQuestionDto {
    return {
      questionId: question.questionId,
      questionText: question.questionText,
      orderNumber: question.orderNumber,
      isDefault: question.isDefault,
      options: (question.options ?? []).map((o) => this.toOptionResponse(o)),
    };
  }

  private toOptionResponse(option: QuestionOption): QuestionOptionDto {
    return {
      optionId: option.optionId,
      optionText: option.optionText,
      scoreValue: option.scoreValue,
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
      questionText: dto.questionText,
      orderNumber: dto.orderNumber ?? null,
      isDefault: dto.isDefault,
      questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
    });

    if (dto.options?.length) {
      await this.repository.saveOptions(
        dto.options.map((o) => ({
          questionId: saved.questionId,
          optionText: o.optionText,
          scoreValue: o.scoreValue,
        })),
      );
    }

    return this.getQuestionById(saved.questionId);
  }

  async updateQuestion(
    questionId: number,
    dto: UpdateSurveyQuestionDto,
  ): Promise<SurveyQuestionDto> {
    const question = await this.repository.findQuestionById(questionId);
    if (!question) throw new NotFoundException(`Question #${questionId} not found`);

    if (dto.questionText !== undefined) question.questionText = dto.questionText;
    const newOrder = dto.orderNumber ?? dto.order_number;
    if (newOrder !== undefined) question.orderNumber = newOrder;
    if (dto.isDefault !== undefined) question.isDefault = dto.isDefault;

    await this.repository.saveQuestion({
      questionId: question.questionId,
      questionText: question.questionText,
      orderNumber: question.orderNumber,
      isDefault: question.isDefault,
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
      questionId: questionId,
      optionText: dto.optionText,
      scoreValue: dto.scoreValue,
    });
    return this.toOptionResponse(saved);
  }

  async updateOption(
    questionId: number,
    optionId: number,
    dto: UpdateQuestionOptionDto,
  ): Promise<QuestionOptionDto> {
    const option = await this.repository.findOptionById(optionId);
    if (!option || option.questionId !== questionId) {
      throw new NotFoundException(`Option #${optionId} not found`);
    }

    if (dto.optionText !== undefined) option.optionText = dto.optionText;
    if (dto.scoreValue !== undefined) option.scoreValue = dto.scoreValue;

    const saved = await this.repository.saveOption(option);
    return this.toOptionResponse(saved);
  }

  async deleteOption(questionId: number, optionId: number): Promise<void> {
    const option = await this.repository.findOptionById(optionId);
    if (!option || option.questionId !== questionId) {
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

  async submitSurvey(
    dto: CreateSymptomSurveyDto,
    caller: UserResponseDto,
  ): Promise<SymptomSurveyResponseDto> {
    if (caller.roles.includes(UserRoleName.PATIENT) && caller.caseId !== dto.caseId) {
      throw new ForbiddenException('You can only submit surveys for your own case');
    }

    // Check if ERAS protocol is completed
    const isErasCompleted = await this.repository.isErasCompleted(dto.caseId);
    if (isErasCompleted) {
      throw new BadRequestException(
        'Cannot submit assessment - ERAS protocol has been completed for this patient',
      );
    }

    const optionIds = dto.answers.map((a) => a.selectedOptionId);
    const options = await this.repository.findOptionsByIds(optionIds);
    const optionMap = new Map(options.map((o) => [o.optionId, o]));

    // Validate all options exist
    for (const answer of dto.answers) {
      if (!optionMap.has(answer.selectedOptionId)) {
        throw new BadRequestException(`Option ID ${answer.selectedOptionId} not found`);
      }
    }

    // RESOLVE TRIAGE COLOR MỚI (No Score)
    const triageResult = this.resolveNewTriageColor(options);
    let triage_color = triageResult.triageColor;
    const triggers = triageResult.triggers;

    // NÔN LŨY KẾ
    const currentPod = await this.repository.findCurrentPod(dto.caseId);
    const vomitCount = await this.repository.countVomitingInPod(dto.caseId, currentPod ?? 0);
    const currentVomitValue = options
      .filter((o) => o.question.clinicalDimension === 'VOMITING')
      .reduce((sum, o) => sum + (o.normalizedValue ?? 0), 0);

    if (vomitCount + currentVomitValue >= 2) {
      triage_color = 'RED';
      triggers.push('CONSECUTIVE_VOMITING_ACCUMULATION');
    }

    // BLOCK TRIGGERED IF RED PENDING
    const pendingRedAlert = await this.alertService.findPendingRedByCaseId(dto.caseId);
    if (dto.assessmentType === 'TRIGGERED' && pendingRedAlert) {
      throw new ForbiddenException(
        'Bệnh nhân đang trong tình trạng cảnh báo ĐỎ. Vui lòng liên hệ điều dưỡng.',
      );
    }

    // Kiểm tra task nếu SCHEDULED
    if (dto.assessmentType === 'SCHEDULED') {
      const task = await this.taskRepository.findPendingTask(
        dto.caseId,
        dto.scheduledSlot || 'MORNING',
        currentPod ?? 0,
      );
      if (!task || task.opensAt > new Date() || task.closesAt < new Date()) {
        throw new BadRequestException('Invalid or expired scheduled assessment task');
      }

      const saved = await this.repository.saveSurvey({
        caseId: dto.caseId,
        evaluationDatetime: new Date(),
        podContext: currentPod,
        totalScore: 0,
        triageColor: triage_color,
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        assessmentType: 'SCHEDULED',
        scheduledSlot: dto.scheduledSlot,
        triageTriggers: triggers,
      });
      await this.taskRepository.markCompleted(task.assessmentTaskId, saved.assessmentId);

      // Sync patient level based on latest triage result
      await this.repository.syncPatientLevel(saved.caseId, triage_color);

      // Notify the Statistics dashboard so it can refetch without a manual reload
      this.statisticsGateway.emitAssessmentSubmitted({
        caseId: saved.caseId,
        assessmentId: saved.assessmentId,
        podContext: saved.podContext,
        triageColor: triage_color,
      });

      // Auto-generate alert for YELLOW or RED
      if (triage_color === 'YELLOW' || triage_color === 'RED') {
        await this.alertService.createAlert({
          caseId: saved.caseId,
          assessmentId: saved.assessmentId,
          surveyScore: 0,
          alertType: triage_color,
        });
      }

      return this.toResponse(saved);
    } else {
      if (pendingRedAlert) {
        throw new ForbiddenException(
          'Cannot submit triggered assessment while a RED alert is pending',
        );
      }

      const saved = await this.repository.saveSurvey({
        caseId: dto.caseId,
        evaluationDatetime: new Date(),
        podContext: currentPod,
        totalScore: 0,
        triageColor: triage_color,
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        assessmentType: 'TRIGGERED',
        triageTriggers: triggers,
      });

      // Save detail rows với SNAPHOT
      const detailData = dto.answers.map((answer) => {
        const opt = optionMap.get(answer.selectedOptionId)!;
        return {
          assessmentId: saved.assessmentId,
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId,
          scoreEarned: opt.scoreValue, // Tương thích ngược
          questionTextSnapshot: opt.question.questionText,
          optionTextSnapshot: opt.optionText,
          clinicalDimensionSnapshot: opt.question.clinicalDimension ?? '',
          optionTriageLevelSnapshot: opt.optionTriageLevel ?? '',
          normalizedValueSnapshot: opt.normalizedValue,
        };
      });
      await this.repository.saveDetails(detailData);

      // Sync patient level based on latest triage result
      await this.repository.syncPatientLevel(saved.caseId, triage_color);

      // Notify the Statistics dashboard so it can refetch without a manual reload
      this.statisticsGateway.emitAssessmentSubmitted({
        caseId: saved.caseId,
        assessmentId: saved.assessmentId,
        podContext: saved.podContext,
        triageColor: triage_color,
      });

      // Auto-generate alert for YELLOW or RED
      if (triage_color === 'YELLOW' || triage_color === 'RED') {
        await this.alertService.createAlert({
          caseId: saved.caseId,
          assessmentId: saved.assessmentId,
          surveyScore: 0,
          alertType: triage_color,
        });
      }

      return this.toResponse(saved);
    }
  }

  async getLatestByPatient(
    caseId: string,
    caller: UserResponseDto,
  ): Promise<SymptomSurveyResponseDto> {
    if (caller.roles.includes(UserRoleName.PATIENT) && caller.caseId !== caseId) {
      throw new ForbiddenException('You can only view your own survey results');
    }
    const survey = await this.repository.findLatestByPatient(caseId);
    if (!survey) throw new NotFoundException(`No survey found for patient ${caseId}`);
    return this.toResponse(survey);
  }

  async getSurveyById(
    assessmentId: number,
    caller: UserResponseDto,
  ): Promise<SymptomSurveyResponseDto> {
    const survey = await this.repository.findById(assessmentId);
    if (!survey) throw new NotFoundException(`Survey #${assessmentId} not found`);
    if (caller.roles.includes(UserRoleName.PATIENT) && caller.caseId !== survey.caseId) {
      throw new ForbiddenException('You can only view your own survey results');
    }
    const details = await this.repository.findDetailsById(assessmentId);
    return this.toResponse(survey, details, true);
  }

  async getAssessmentHistory(
    caseId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedAssessmentHistoryDto> {
    const [surveys, total] = await this.repository.findAllByPatient(caseId, page, limit);

    const data: AssessmentHistoryItemDto[] = await Promise.all(
      surveys.map(async (survey) => {
        const details = await this.repository.findDetailsById(survey.assessmentId);
        return {
          assessmentId: survey.assessmentId,
          evaluationDatetime: survey.evaluationDatetime,
          podContext: survey.podContext,
          totalScore: survey.totalScore,
          triageColor: survey.triageColor,
          details: details.map(
            (d): AnswerDetailDto => ({
              questionId: d.questionId,
              questionText: d.question.questionText,
              selectedOptionId: d.selectedOptionId,
              optionText: d.selectedOption.optionText,
              scoreEarned: d.scoreEarned,
            }),
          ),
        };
      }),
    );

    return { data, total, page, limit };
  }

  async getPatientPodHistory(
    caseId: string,
    caller: UserResponseDto,
  ): Promise<PatientPodTimelineResponseDto> {
    if (caller.roles.includes(UserRoleName.PATIENT) && caller.caseId !== caseId) {
      throw new ForbiddenException('You can only view your own assessment history');
    }

    const patient = await this.repository.findPatientByCaseId(caseId);
    if (!patient) {
      throw new NotFoundException(`Patient with caseId ${caseId} not found`);
    }

    const currentPodNum = Math.min(Math.max(patient.currentPod ?? 0, 0), 5);
    const startDate = patient.podStartDate ? new Date(patient.podStartDate) : new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [allSurveys] = await this.repository.findAllByPatient(caseId, 1, 100);
    const surveyMap = new Map<number, SymptomSurvey>();
    for (const survey of allSurveys) {
      if (survey.podContext !== null && survey.podContext !== undefined) {
        surveyMap.set(survey.podContext, survey);
      }
    }

    const totalQuestions = await this.repository.countQuestions();
    const historyItems: PodHistoryItemDto[] = [];

    // Only generate timeline from POD 0 up to currentPod (max POD 5)
    for (let pod = 0; pod <= currentPodNum; pod++) {
      const evalDate = new Date(startDate);
      evalDate.setDate(evalDate.getDate() + pod);
      const evalDayNormalized = new Date(evalDate);
      evalDayNormalized.setHours(0, 0, 0, 0);

      // Do NOT include future dates beyond today
      if (evalDayNormalized > today) {
        break;
      }

      const survey = surveyMap.get(pod);
      if (survey) {
        const details = await this.repository.findDetailsById(survey.assessmentId);
        const triageColor = survey.triageColor ?? 'GREEN';
        const recoveryStatusTag =
          triageColor === 'GREEN'
            ? 'Hồi phục tốt'
            : triageColor === 'YELLOW'
              ? 'Cần theo dõi'
              : 'Cần can thiệp';

        historyItems.push({
          date: survey.evaluationDatetime,
          podNumber: pod,
          isAssessed: true,
          assessmentId: survey.assessmentId,
          totalScore: survey.totalScore,
          triageColor: survey.triageColor,
          recoveryStatusTag,
          completedCount: details.length > 0 ? details.length : totalQuestions,
          totalCount: totalQuestions > 0 ? totalQuestions : 5,
          details: details.map(
            (d): AnswerDetailDto => ({
              questionId: d.questionId,
              questionText: d.question.questionText,
              selectedOptionId: d.selectedOptionId,
              optionText: d.selectedOption.optionText,
              scoreEarned: d.scoreEarned,
            }),
          ),
          medicalFeedback: TRIAGE_RECOMMENDATIONS[triageColor] ?? null,
        });
      } else {
        historyItems.push({
          date: evalDate,
          podNumber: pod,
          isAssessed: false,
          assessmentId: null,
          totalScore: null,
          triageColor: null,
          recoveryStatusTag: 'Chưa đánh giá',
          completedCount: 0,
          totalCount: totalQuestions > 0 ? totalQuestions : 5,
          details: [],
          medicalFeedback: null,
        });
      }
    }

    return {
      caseId: patient.caseId,
      currentPod: currentPodNum,
      isLocked: Boolean(patient.isLocked),
      history: historyItems,
    };
  }
}
