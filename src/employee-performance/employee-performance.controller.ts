import { Controller, Get, Query } from '@nestjs/common';
import { EmployeePerformanceService } from './employee-performance.service';

@Controller('employee-performance')
export class EmployeePerformanceController {
  constructor(private readonly performanceService: EmployeePerformanceService) {}

  @Get('my-metrics')
  // Guard hata diya, ab hum direct query se id le rahe hain jise hum tickets mein lete hain
  async getMyPerformance(@Query('employeeId') employeeId: string) {
    return this.performanceService.getMyPerformance(Number(employeeId));
  }
}