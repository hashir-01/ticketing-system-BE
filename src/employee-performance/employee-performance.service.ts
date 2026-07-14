import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeePerformanceService {
  constructor(private prisma: PrismaService) {}

  async getMyPerformance(userId: number) {
    const now = new Date();
    const currentPeriod = `${now.toLocaleString('en-US', { month: 'long' }).toUpperCase()}_${now.getFullYear()}`;

    // Find current period performance metrics
    const performance = await this.prisma.employeePerformance.findUnique({
      where: {
        employeeId_period: {
          employeeId: userId,
          period: currentPeriod,
        },
      },
    });

    if (!performance) {
      // Return safe schema defaults if month record is newly instantiated
      return {
        employeeId: userId,
        period: currentPeriod,
        ticketsAssignedTotal: 0,
        assignedCriticalCount: 0,
        assignedHighCount: 0,
        assignedMediumCount: 0,
        assignedLowCount: 0,
        ticketsClosedTotal: 0,
        closedInTimeTotal: 0,
        closedAfterDeadline: 0,
        activeWorkloadTotal: 0,
        activeWorkloadBreached: 0,
        inTimeCriticalCount: 0,
        inTimeHighCount: 0,
        inTimeMediumCount: 0,
        inTimeLowCount: 0,
        afterDeadlineCriticalCount: 0,
        afterDeadlineHighCount: 0,
        afterDeadlineMediumCount: 0,
        afterDeadlineLowCount: 0,
      };
    }

    return performance;
  }
}