import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // 1. Check if the database connection is alive
      () => this.db.pingCheck('database', { timeout: 3000 }),

      // 2. Check if memory heap usage is below 150MB
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      // 3. Check if disk usage on the root path '/' is below 90%
      () => this.disk.checkStorage('disk_storage', { thresholdPercent: 0.9, path: '/' }),
    ]);
  }
}
