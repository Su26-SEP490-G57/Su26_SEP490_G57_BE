import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiseaseController } from './controllers/disease.controller';
import { Disease } from './entities/disease.entity';
import { DiseaseService } from './services/disease.service';

@Module({
  imports: [TypeOrmModule.forFeature([Disease])],
  providers: [DiseaseService],
  controllers: [DiseaseController],
})
export class DiseaseModule {}
