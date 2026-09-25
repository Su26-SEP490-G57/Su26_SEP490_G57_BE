import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';

export type PatientNotificationCategory = 'medical' | 'system';

/** Lịch sử thông báo hiển thị trong màn "Thông báo hệ thống" của app mobile. */
@Entity('patient_notifications')
export class PatientNotification {
  @PrimaryGeneratedColumn({ name: 'notification_id', type: 'int' })
  notificationId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  /** Khớp 2 tab lọc trên mobile: "Khảo sát & Dinh dưỡng" (medical) / "Hệ thống" (system). */
  @Column({ type: 'varchar', length: 20, default: 'medical' })
  category!: PatientNotificationCategory;

  /** Điều hướng khi bấm vào thông báo — khớp AppNotificationPayload.route bên mobile. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  route!: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
