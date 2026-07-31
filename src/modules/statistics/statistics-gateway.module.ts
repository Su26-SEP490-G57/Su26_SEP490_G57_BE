import { Module } from '@nestjs/common';
import { StatisticsGateway } from './gateways/statistics.gateway';

// Kept separate from StatisticsModule (which imports PatientModule ->
// SymptomSurveyModule) so SymptomSurveyModule can inject StatisticsGateway
// without creating a circular module dependency.
@Module({
  providers: [StatisticsGateway],
  exports: [StatisticsGateway],
})
export class StatisticsGatewayModule {}
