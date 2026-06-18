import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertModule } from './modules/alert/alert.module';
import { AuthModule } from './modules/auth/auth.module';
import { PatientModule } from './modules/patient/patient.module';
import { SymptomSurveyModule } from './modules/symptom-survey/symptom-survey.module';
import { UsersModule } from './modules/user/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST') ?? 'localhost',
        port: Number(config.get('DB_PORT') ?? 5432),
        username: config.get('DB_USER') ?? 'postgres',
        password: config.get('DB_PASSWORD') ?? 'postgres',
        database: config.get('DB_NAME') ?? 'SEP490_G57',
        schema: config.get('DB_SCHEMA') ?? 'public',
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    PatientModule,
    SymptomSurveyModule,
    AlertModule,
  ],
})
export class AppModule {}
