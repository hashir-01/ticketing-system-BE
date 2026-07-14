import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentProgressService {
  constructor(private prisma: PrismaService) {}

  async getDepartmentAndEmployeePerformance(managerUserId: number) {
    const now = new Date();
    // Jaise aapne employee-performance mein period calculate kiya tha exact wahi system:
    const currentPeriod = `${now.toLocaleString('en-US', { month: 'long' }).toUpperCase()}_${now.getFullYear()}`;

    // 1. Logged-in user ka department id dhoondhein
    const user = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      include: { department: true }
    });

    if (!user || !user.departmentId) {
      throw new NotFoundException('Is user ka koi department nahi mila.');
    }

    const deptId = user.departmentId;
    const deptName = user.department?.name || 'Your Department';

    // 2. Us specific department ki performance row nikalein
    let deptPerformance = await this.prisma.departmentPerformance.findUnique({
      where: {
        departmentId_period: {
          departmentId: deptId,
          period: currentPeriod,
        },
      },
    });

    if (!deptPerformance) {
      // Safe Fallback schema defaults agar data entries abhi create na hui hon
      deptPerformance = {
        id: 0,
        departmentId: deptId,
        period: currentPeriod,
        ticketsAssignedTotal: 0,
        ticketsResolvedTotal: 0,
        closedInTimeTotal: 0,
        currentWorkingTotal: 0,
        currentWorkingBreachedTotal: 0,
      } as any;
    }

    // 3. Usi department ke saare employees ki performance fetch karein
    const employeesInDept = await this.prisma.user.findMany({
      where: { departmentId: deptId },
      select: { id: true, name: true, role: true }
    });

    const employeePerformances = await Promise.all(
      employeesInDept.map(async (emp) => {
        let empPerf = await this.prisma.employeePerformance.findUnique({
          where: {
            employeeId_period: {
              employeeId: emp.id,
              period: currentPeriod,
            }
          }
        });

        if (!empPerf) {
          empPerf = {
            employeeId: emp.id,
            period: currentPeriod,
            ticketsAssignedTotal: 0,
            ticketsClosedTotal: 0,
            closedInTimeTotal: 0,
            closedAfterDeadline: 0,
            activeWorkloadTotal: 0,
            activeWorkloadBreached: 0,
          } as any;
        }

        return {
          employeeInfo: emp,
          metrics: empPerf
        };
      })
    );

    return {
      department: { id: deptId, name: deptName },
      period: currentPeriod,
      departmentPerformance: deptPerformance,
      employeePerformances
    };
  }

  async getAllDepartmentsPerformance() {
    const now = new Date();
    const currentPeriod = `${now.toLocaleString('en-US', { month: 'long' }).toUpperCase()}_${now.getFullYear()}`;

    // 1. Saare departments fetch karein unke users ke sath
    const departments = await this.prisma.department.findMany({
      include: {
        users: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    // 2. Har department aur uske employees ka data map karein
    const report = await Promise.all(
      departments.map(async (dept) => {
        // Department ki overall performance row
        let deptPerf = await this.prisma.departmentPerformance.findUnique({
          where: {
            departmentId_period: { departmentId: dept.id, period: currentPeriod }
          }
        });

        if (!deptPerf) {
          deptPerf = {
            ticketsAssignedTotal: 0,
            ticketsResolvedTotal: 0,
            closedInTimeTotal: 0,
            currentWorkingTotal: 0,
          } as any;
        }

        // Department ke employees ki individual performance
        const employeePerfs = await Promise.all(
          dept.users.map(async (emp) => {
            let empPerf = await this.prisma.employeePerformance.findUnique({
              where: {
                employeeId_period: { employeeId: emp.id, period: currentPeriod }
              }
            });

            if (!empPerf) {
              empPerf = {
                ticketsAssignedTotal: 0,
                ticketsClosedTotal: 0,
                closedInTimeTotal: 0,
                activeWorkloadTotal: 0,
              } as any;
            }

            return {
              info: emp,
              metrics: empPerf
            };
          })
        );

        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          performance: deptPerf,
          employees: employeePerfs
        };
      })
    );

    return {
      period: currentPeriod,
      departments: report
    };
  }
}