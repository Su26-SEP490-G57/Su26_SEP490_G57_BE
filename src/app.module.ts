import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertModule } from './modules/alert/alert.module';
import { AuthModule } from './modules/auth/auth.module';
import { DietGuidanceModule } from './modules/diet-guidance/diet-guidance.module';
import { NurseModule } from './modules/nurse/nurse.module';
import { PatientModule } from './modules/patient/patient.module';
import { SymptomSurveyModule } from './modules/symptom-survey/symptom-survey.module';
import { UsersModule } from './modules/user/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST') ?? 'localhost',
        port: Number(config.get('DB_PORT') ?? 5432),
        username: config.get('DB_USER') ?? 'postgres',
        password: config.get('DB_PASSWORD') ?? 'postgres',
        database: config.get('DB_NAME') ?? 'SEP490_G57',
        autoLoadEntities: true,
        synchronize: false,
        retryAttempts: config.get<number>('DB_RETRY_ATTEMPTS', 1),
        retryDelay: config.get<number>('DB_RETRY_DELAY', 1000),
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    NurseModule,
    PatientModule,
    SymptomSurveyModule,
    AlertModule,
    DietGuidanceModule,
  ],
})
export class AppModule {}
