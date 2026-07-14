import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { DepartmentProgressService } from './department-progress.service';

@Controller('department-progress')
export class DepartmentProgressController {
  constructor(private readonly departmentProgressService: DepartmentProgressService) {}

  @Get('manager-analytics')
  async getAnalytics(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId query parameter lazmi bhein.');
    }
    const parsedUserId = parseInt(userId, 10);
    return this.departmentProgressService.getDepartmentAndEmployeePerformance(parsedUserId);
  }

  @Get('all-departments')
async getAllAnalytics() {
  return this.departmentProgressService.getAllDepartmentsPerformance();
}
}