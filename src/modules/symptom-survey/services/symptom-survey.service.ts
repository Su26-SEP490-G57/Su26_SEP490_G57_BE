import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertService } from '../../alert/services/alert.service';
import { triageColorFromLevelId } from '../../patient/constants/levels.constant';
import { StatisticsGateway } from '../../statistics/gateways/statistics.gateway';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../constants/questionnaire-version.constant';
import { CreateReassessmentDto } from '../dtos/create-reassessment.dto';
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
import { SymptomSurvey } from '../entities/symptom-survey.entity';
// 'AssessmentTask' là dependency được gọi ngầm trong taskRepository
// import { AssessmentTask } from '../entities/assessment-task.entity';
import { AssessmentDetail } from '../entities/assessment-detail.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { SurveyQuestion } from '../entities/survey-question.entity';
import { SymptomSurveyRepository } from '../repositories/symptom-survey.repository';
import { AssessmentTaskRepository } from '../repositories/assessment-task.repository';
import { DataSource } from 'typeorm';

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
    private readonly dataSource: DataSource,
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
      triageColor: survey.triageColor,
    };

    if (details && details.length > 0) {
      dto.details = details.map(
        (d): AnswerDetailDto => ({
          questionId: d.questionId,
          questionText: d.questionTextSnapshot, // Sử dụng snapshot
          selectedOptionId: d.selectedOptionId,
          optionText: d.optionTextSnapshot, // Sử dụng snapshot
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
      optionTriageLevel: option.optionTriageLevel,
      optionDefinition: option.optionDefinition,
      normalizedValue: option.normalizedValue,
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
          optionTriageLevel: o.optionTriageLevel,
          optionDefinition: o.optionDefinition ?? null,
          normalizedValue: o.normalizedValue ?? null,
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
      optionTriageLevel: dto.optionTriageLevel,
      optionDefinition: dto.optionDefinition ?? null,
      normalizedValue: dto.normalizedValue ?? null,
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
    if (dto.optionTriageLevel !== undefined) option.optionTriageLevel = dto.optionTriageLevel;
    if (dto.optionDefinition !== undefined) option.optionDefinition = dto.optionDefinition;
    if (dto.normalizedValue !== undefined) option.normalizedValue = dto.normalizedValue;

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

    // Load selected options for clinical triage evaluation.
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

    // The server determines scheduled versus triggered from the currently open task.
    // Client-provided assessmentType/scheduledSlot are intentionally ignored.
    const currentPod = await this.repository.findCurrentPod(dto.caseId);
    const now = new Date();
    const openScheduledTask = await this.taskRepository.findOpenPendingTask(
      dto.caseId,
      currentPod ?? 0,
      now,
    );

    const patientInfo = await this.repository.findPatientByCaseId(dto.caseId);
    const currentTriage = triageColorFromLevelId(patientInfo?.levelId);

    // Đỏ luôn chờ bác sĩ ra chỉ định tiếp theo — bất kể alert đã HANDLED hay
    // chưa, bất kể đã hết 60 phút cooldown, và bất kể có task đã lên lịch đang
    // mở hay không. Chỉ nhân viên y tế đánh giá lại (createReassessment) mới
    // đổi được trạng thái, không tự nộp bài để thoát Đỏ được nữa.
    if (currentTriage === 'RED' || (await this.alertService.isAssessmentLocked(dto.caseId, now))) {
      throw new ForbiddenException('Chờ chỉ định tiếp theo của bác sĩ.');
    }

    // Vàng: cần đủ 2 điều kiện để làm bài đánh giá TỰ DO (không phải định kỳ) —
    // (1) alert Vàng gần nhất đã HANDLED, và (2) đã qua đúng 60 phút kể từ
    // triggeredAt (mốc tuyệt đối, không dùng giờ đồng hồ nên không phụ thuộc
    // timezone). Chưa handled thì dù có qua 60 phút vẫn chỉ được làm bài định
    // kỳ (openScheduledTask) — nhánh if bên dưới không chạy khi có task định kỳ
    // đang mở, nên luôn được phép nộp bài định kỳ bất kể trạng thái khóa.
    if (currentTriage === 'YELLOW' && !openScheduledTask) {
      const { isLocked, remainingMinutes } = await this.alertService.getAssessmentLockStatus(
        dto.caseId,
        'YELLOW',
        now,
      );
      if (isLocked) {
        const message =
          remainingMinutes !== null
            ? `Bệnh nhân thuộc nhóm theo dõi (Vàng), vui lòng chờ ${remainingMinutes} phút để thực hiện đánh giá lại.`
            : 'Bệnh nhân thuộc nhóm theo dõi (Vàng) chưa được điều dưỡng xử trí — chỉ có thể thực hiện đánh giá định kỳ.';
        throw new ForbiddenException(message);
      }
    }

    const vomitCount = await this.repository.countVomitingInPod(dto.caseId, currentPod ?? 0);
    const currentVomitValue = options
      .filter((o) => o.question.clinicalDimension === 'VOMITING')
      .reduce((sum, o) => sum + (o.normalizedValue ?? 0), 0);

    if (vomitCount + currentVomitValue >= 2) {
      triage_color = 'RED';
      triggers.push('CONSECUTIVE_VOMITING_ACCUMULATION');
    }

    // Persist the assessment, its detail rows, and any scheduled task update atomically.
    const savedSurvey = await this.dataSource.transaction(async (transactionalEntityManager) => {
      const isScheduled = openScheduledTask !== null;

      const survey = transactionalEntityManager.create(SymptomSurvey, {
        caseId: dto.caseId,
        evaluationDatetime: now,
        podContext: currentPod,
        triageColor: triage_color,
        triageVerdictSnapshot: triage_color, // Snapshot bất biến tại đây
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        assessmentType: isScheduled ? 'SCHEDULED' : 'TRIGGERED',
        scheduledSlot: isScheduled ? openScheduledTask.scheduledSlot : null,
        triageTriggers: triggers,
      });

      const savedSurvey = await transactionalEntityManager.save(survey);

      if (isScheduled) {
        await this.taskRepository.markCompleted(
          openScheduledTask.assessmentTaskId,
          savedSurvey.assessmentId,
          transactionalEntityManager,
        );
      }

      const detailData = dto.answers.map((answer) => {
        const opt = optionMap.get(answer.selectedOptionId)!;
        return transactionalEntityManager.create(AssessmentDetail, {
          assessmentId: savedSurvey.assessmentId,
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId,
          questionTextSnapshot: opt.question.questionText,
          optionTextSnapshot: opt.optionText,
          clinicalDimensionSnapshot: opt.question.clinicalDimension ?? '',
          optionTriageLevelSnapshot: opt.optionTriageLevel ?? '',
          normalizedValueSnapshot: opt.normalizedValue,
        });
      });
      await transactionalEntityManager.save(detailData);

      // Sync patient level (có thể dùng saveSurvey -> sync)
      await this.repository.syncPatientLevel(savedSurvey.caseId, triage_color);

      return savedSurvey;
    });

    this.statisticsGateway.emitAssessmentSubmitted({
      caseId: savedSurvey.caseId,
      assessmentId: savedSurvey.assessmentId,
      podContext: savedSurvey.podContext,
      triageColor: triage_color,
    });

    // GREEN remains available through the patient-level dashboard filter.
    // YELLOW and RED additionally create dashboard alert records; only RED sends push notifications.
    if (triage_color === 'YELLOW' || triage_color === 'RED') {
      await this.alertService.createAlert({
        caseId: savedSurvey.caseId,
        assessmentId: savedSurvey.assessmentId,
        alertType: triage_color,
      });
    }

    return this.toResponse(savedSurvey);
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
          triageColor: survey.triageColor,
          // Phân biệt bài khảo sát thường và đánh giá lại lâm sàng.
          // source mặc định 'SURVEY' cho các bản ghi cũ chưa có cột này.
          source: (survey.source ?? 'SURVEY') as 'SURVEY' | 'REASSESSMENT',
          nurseNote: survey.nurseNote ?? null,
          details: details.map(
            (d): AnswerDetailDto => ({
              questionId: d.questionId,
              questionText: d.question.questionText,
              selectedOptionId: d.selectedOptionId,
              optionText: d.selectedOption.optionText,
            }),
          ),
        };
      }),
    );

    return { data, total, page, limit };
  }

  /**
   * Tạo đánh giá lại lâm sàng (Reassessment) do điều dưỡng thực hiện.
   *
   * Chiến lược: Lưu vào cùng bảng `patient_assessments` với `source = 'REASSESSMENT'`
   * và `details = []`. Như vậy `getAssessmentHistory` tự nhiên trả về đúng thứ tự
   * thời gian mà không cần UNION hay query từ 2 bảng khác nhau.
   */
  async submitReassessment(
    dto: CreateReassessmentDto,
    caller: UserResponseDto,
  ): Promise<AssessmentHistoryItemDto> {
    const patient = await this.repository.findPatientByCaseId(dto.caseId);
    if (!patient) {
      throw new NotFoundException(`Patient with caseId ${dto.caseId} not found`);
    }

    const currentPod = await this.repository.findCurrentPod(dto.caseId);
    const source = dto.source === 'NOTE' ? 'NOTE' : 'REASSESSMENT';
    const isNoteOnly = source === 'NOTE';

    // Lưu vào patient_assessments. Nếu là ghi chú đơn thuần (NOTE), triageColor = null.
    const saved = await this.repository.saveSurvey({
      caseId: dto.caseId,
      evaluationDatetime: new Date(),
      podContext: currentPod,
      triageColor: isNoteOnly ? null : (dto.triageColor ?? null),
      questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      assessmentType: 'TRIGGERED',
      triageTriggers: [],
      source: source,
      nurseNote: dto.nurseNote ?? null,
      nurseId: caller.id,
    });

    // CHỈ CẬP NHẬT TRẠNG THÁI NẾU LÀ REASSESSMENT (KHÔNG ĐỔI TRẠNG THÁI NẾU LÀ GHI CHÚ ĐƠN THUẦN)
    if (!isNoteOnly && dto.triageColor) {
      await this.repository.syncPatientLevel(saved.caseId, dto.triageColor);

      // Đóng các alert cũ đang chờ xử trí (đánh giá lại coi như đã xử trí xong đợt cũ).
      await this.alertService.updateAlertsOnReassessment(
        saved.caseId,
        dto.triageColor,
        saved.assessmentId,
        caller.id,
      );

      // Nếu kết quả đánh giá lại là Đỏ/Vàng, phải tạo alert MỚI (giống hệt
      // submitSurvey của patient tự nộp) — nếu không thì không có alert nào ở
      // trạng thái PENDING_REVIEW để nurse/doctor "Xác nhận xử trí", và bệnh
      // nhân Đỏ sẽ bị khoá vĩnh viễn vì không có mốc triggeredAt nào để đếm
      // ngược 60 phút mở khoá sau khi xử trí.
      if (dto.triageColor === 'YELLOW' || dto.triageColor === 'RED') {
        await this.alertService.createAlert({
          caseId: saved.caseId,
          assessmentId: saved.assessmentId,
          alertType: dto.triageColor,
        });
      }

      this.statisticsGateway.emitAssessmentSubmitted({
        caseId: saved.caseId,
        assessmentId: saved.assessmentId,
        podContext: saved.podContext,
        triageColor: dto.triageColor,
      });
    }

    return {
      assessmentId: saved.assessmentId,
      evaluationDatetime: saved.evaluationDatetime,
      podContext: saved.podContext,
      triageColor: saved.triageColor,
      source: source,
      nurseNote: dto.nurseNote ?? null,
      details: [],
    };
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

    const calculatedPod = patient.currentPod ?? 0;
    const currentPodNum = Math.min(Math.max(calculatedPod, 0), 7);
    let maxPodNum = currentPodNum;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = patient.podStartDate
      ? new Date(patient.podStartDate)
      : new Date(today.getTime() - currentPodNum * 86400000);
    startDate.setHours(0, 0, 0, 0);

    const [allSurveys] = await this.repository.findAllByPatient(caseId, 1, 100);
    const surveyMap = new Map<number, SymptomSurvey>();
    for (const survey of allSurveys) {
      if (survey.podContext !== null && survey.podContext !== undefined) {
        surveyMap.set(survey.podContext, survey);
        if (survey.podContext > maxPodNum) {
          maxPodNum = Math.min(survey.podContext, 7);
        }
      }
    }

    const totalQuestions = await this.repository.countQuestions();
    const historyItems: PodHistoryItemDto[] = [];

    // Generate timeline from POD 0 up to maxPodNum
    for (let pod = 0; pod <= maxPodNum; pod++) {
      const evalDate = new Date(startDate);
      evalDate.setDate(evalDate.getDate() + pod);
      const evalDayNormalized = new Date(evalDate);
      evalDayNormalized.setHours(0, 0, 0, 0);

      const survey = surveyMap.get(pod);

      // If no assessment exists for this POD and the date is in the future, skip it
      if (!survey && evalDayNormalized > today && pod > currentPodNum) {
        break;
      }

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
          triageColor: null,
          recoveryStatusTag: 'Chưa đánh giá',
          completedCount: 0,
          totalCount: totalQuestions > 0 ? totalQuestions : 5,
          details: [],
          medicalFeedback: null,
        });
      }
    }

    // Include any additional surveys from allSurveys (e.g. multiple intraday surveys)
    const processedIds = new Set(historyItems.map((h) => h.assessmentId).filter(Boolean));
    for (const survey of allSurveys) {
      if (!processedIds.has(survey.assessmentId)) {
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
          podNumber: survey.podContext ?? currentPodNum,
          isAssessed: true,
          assessmentId: survey.assessmentId,
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
            }),
          ),
          medicalFeedback: TRIAGE_RECOMMENDATIONS[triageColor] ?? null,
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
