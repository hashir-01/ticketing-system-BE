import { Module } from '@nestjs/common';
import { EmployeePerformanceService } from './employee-performance.service';
import { EmployeePerformanceController } from './employee-performance.controller';

@Module({
  providers: [EmployeePerformanceService],
  controllers: [EmployeePerformanceController]
})
export class EmployeePerformanceModule {}
