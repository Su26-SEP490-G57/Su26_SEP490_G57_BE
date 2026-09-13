import { AlertType } from '../entities/alert.entity';

export class CreateAlertDto {
  caseId!: string;
  assessmentId!: number;
  alertType!: AlertType;
}
