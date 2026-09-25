import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { User } from '../../user/entities/user.entity';

@Entity('custom_diet_guidances')
export class CustomDietGuidance {
  @PrimaryGeneratedColumn({ name: 'custom_diet_id', type: 'int' })
  customDietId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'doctor_id', type: 'int' })
  doctorId!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: User;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 100, default: 'Chế độ ăn chỉ định riêng' })
  label!: string;

  @Column({ name: 'meals_per_day_min', type: 'int', nullable: true })
  mealsPerDayMin!: number | null;

  @Column({ name: 'meals_per_day_max', type: 'int', nullable: true })
  mealsPerDayMax!: number | null;

  @Column({ name: 'meal_instruction', type: 'text', nullable: true })
  mealInstruction!: string | null;

  @Column({ name: 'volume_per_meal_min', type: 'int', nullable: true })
  volumePerMealMin!: number | null;

  @Column({ name: 'volume_per_meal_max', type: 'int', nullable: true })
  volumePerMealMax!: number | null;

  @Column({ name: 'volume_instruction', type: 'text', nullable: true })
  volumeInstruction!: string | null;

  @Column({ name: 'recommended_foods', type: 'text', array: true, default: '{}' })
  recommendedFoods!: string[];

  @Column({ name: 'recommended_drinks', type: 'text', array: true, default: '{}' })
  recommendedDrinks!: string[];

  @Column({ name: 'forbidden_foods', type: 'text', array: true, default: '{}' })
  forbiddenFoods!: string[];

  @Column({ name: 'forbidden_drinks', type: 'text', array: true, default: '{}' })
  forbiddenDrinks!: string[];

  @Column({ name: 'doctor_notes', type: 'text', nullable: true })
  doctorNotes!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
