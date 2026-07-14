import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if necessary
import { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentService {
  // 1. Inject your Prisma Service
  constructor(private prisma: PrismaService) {}

  async create(createDepartmentDto: CreateDepartmentDto) {
    const { name, code } = createDepartmentDto;

    // 2. Check if a department with that code already exists to prevent database crashes
    const existingDept = await this.prisma.department.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existingDept) {
      throw new ConflictException(`Department with code '${code}' already exists.`);
    }

    // Current standard tracking period for analytical charts
    const currentPeriod = 'JULY_2026';

    // 3. Create Department and its blank Performance row within an isolated transactional cycle
    return this.prisma.$transaction(async (tx) => {
      const newDepartment = await tx.department.create({
        data: {
          name,
          code: code.toUpperCase(), // Standardize code values to uppercase in DB
        },
      });

      // Initialize the tracking state counters seamlessly set to 0
      await tx.departmentPerformance.create({
        data: {
          departmentId: newDepartment.id,
          period: currentPeriod,
          ticketsAssignedTotal: 0,
          assignedCriticalCount: 0,
          assignedHighCount: 0,
          assignedMediumCount: 0,
          assignedLowCount: 0,
          ticketsResolvedTotal: 0,
          resolvedCriticalCount: 0,
          resolvedHighCount: 0,
          resolvedMediumCount: 0,
          resolvedLowCount: 0,
          closedInTimeTotal: 0,
          inTimeCriticalCount: 0,
          inTimeHighCount: 0,
          inTimeMediumCount: 0,
          inTimeLowCount: 0,
          closedAfterDeadlineTotal: 0,
          afterDeadlineCriticalCount: 0,
          afterDeadlineHighCount: 0,
          afterDeadlineMediumCount: 0,
          afterDeadlineLowCount: 0,
          currentWorkingTotal: 0,
          currentWorkingBreachedTotal: 0,
        },
      });

      return newDepartment;
    });
  }

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: {
        name: 'asc', // Keeps them sorted alphabetically for your frontend dropdown
      },
    });
  }

  // 2. Delete a specific department by ID along with its performance record cleanly
  async remove(id: string) {
    const departmentIdNum = Number(id);

    // Check if it exists first so we can throw a clean 404 error if it doesn't
    const department = await this.prisma.department.findUnique({
      where: { id: departmentIdNum },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found.`);
    }

    // Execute cascading cleanup smoothly across metrics inside a safe transaction
    await this.prisma.$transaction(async (tx) => {
      // First wipe historical granular analytical records
      await tx.departmentPerformance.deleteMany({
        where: { departmentId: departmentIdNum },
      });

      // Wipe core department object context
      await tx.department.delete({
        where: { id: departmentIdNum },
      });
    });

    return { message: 'Department successfully deleted' };
  }
}