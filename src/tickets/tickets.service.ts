import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async createTicket(dto: CreateTicketDto, creatorUser: { id: number; role: string }) {
    const { title, description, impact, urgency, resolvingDepartment, resolverRole } = dto;
    const now = new Date();

    let finalCreatorId = creatorUser.id;

    const userExists = await this.prisma.user.findUnique({
      where: { id: finalCreatorId },
    });

    if (!userExists) {
      const anyUser = await this.prisma.user.findFirst();
      
      if (anyUser) {
        finalCreatorId = anyUser.id;
      } else {
        const fallbackUser = await this.prisma.user.create({
          data: {
            id: 1,
            name: 'Fallback Test Account',
            email: 'test@company.com',
            cnic: '00000-0000000-0',
            password: 'secret_password',
            role: 'SUPER_ADMIN', 
          },
        });
        finalCreatorId = fallbackUser.id;
      }
    }

    const priority = this.calculatePriority(impact, urgency, userExists ? creatorUser.role : 'SUPER_ADMIN');
    const expectedResolveMinutes = this.getExpectedMinutes(priority);
    const deadlineAt = this.calculateSlaDeadline(now, expectedResolveMinutes);
    const assignedEmployeeId = await this.findBestAssignee(resolvingDepartment, resolverRole);

    const createdTicket = await this.prisma.ticket.create({
      data: {
        title,
        description,
        status: assignedEmployeeId ? 'ASSIGNED' : 'OPEN',
        priority,
        impact: impact.toUpperCase(),
        urgency: urgency.toUpperCase(),
        resolvingDepartment,
        resolverRole: resolverRole || null,
        createdById: finalCreatorId, 
        currentAssignedToId: assignedEmployeeId, 
        routingStatus: 'NONE', 
        
        assignees: assignedEmployeeId ? {
          create: {
            userId: assignedEmployeeId,
          }
        } : undefined,

        expectedResolveMinutes,
        deadlineAt,
        createdAt: now,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        currentAssignedTo: { select: { id: true, name: true, role: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, role: true } }
          }
        }
      },
    });

    // 🔥 LIVE TRACK: User performance synchronization
    if (assignedEmployeeId) {
      this.syncUserPerformanceMetrics(assignedEmployeeId);
    }

    // 🏢 LIVE TRACK: Department tracking triggers
    this.syncDepartmentPerformanceMetrics(resolvingDepartment);

    return createdTicket;
  }

  private calculatePriority(impact: string, urgency: string, creatorRole: string): string {
    const role = creatorRole.toUpperCase();
    if (role === 'SUPER_ADMIN' || role === 'MANAGER') {
      return 'CRITICAL';
    }

    const imp = impact.toUpperCase();
    const urg = urgency.toUpperCase();

    if (imp === 'HIGH' && urg === 'HIGH') return 'CRITICAL';
    if ((imp === 'HIGH' && urg === 'MEDIUM') || (imp === 'MEDIUM' && urg === 'HIGH')) return 'HIGH';
    if (imp === 'LOW' && urg === 'LOW') return 'LOW';
    if ((imp === 'MEDIUM' && urg === 'LOW') || (imp === 'LOW' && urg === 'MEDIUM')) return 'LOW';
    
    return 'MEDIUM'; 
  }

  private getExpectedMinutes(priority: string): number {
    switch (priority.toUpperCase()) {
      case 'CRITICAL': return 60;
      case 'HIGH': return 240;
      case 'MEDIUM': return 480;
      case 'LOW': return 1440;
      default: return 480;
    }
  }

  private calculateSlaDeadline(startDate: Date, minutesToAdd: number): Date {
    let current = new Date(startDate.getTime());
    let remainingMinutes = minutesToAdd;

    while (remainingMinutes > 0) {
      const day = current.getDay();
      if (day === 6) { 
        current.setDate(current.getDate() + 2);
        current.setHours(9, 0, 0, 0);
        continue;
      }
      if (day === 0) { 
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
        continue;
      }

      const dayStart = new Date(current.getTime()).setHours(9, 0, 0, 0);
      const dayEnd = new Date(current.getTime()).setHours(18, 0, 0, 0);

      if (current.getTime() < dayStart) {
        current.setHours(9, 0, 0, 0);
        continue;
      }
      if (current.getTime() >= dayEnd) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
        continue;
      }

      const availableMinutesToday = (dayEnd - current.getTime()) / 60000;

      if (remainingMinutes <= availableMinutesToday) {
        current.setMinutes(current.getMinutes() + remainingMinutes);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= availableMinutesToday;
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
      }
    }

    return current;
  }

  private async findBestAssignee(deptCode: string, targetRole?: string): Promise<number | null> {
    const department = await this.prisma.department.findUnique({
      where: { code: deptCode },
    });

    if (!department) {
      throw new NotFoundException(`Resolving Department matching code '${deptCode}' not found.`);
    }

    const userFilter: any = {
      departmentId: department.id,
    };

    if (targetRole && targetRole.trim() !== '') {
      userFilter.role = targetRole.toUpperCase();
    } else {
      userFilter.role = {
        notIn: ['MANAGER', 'SUPER_ADMIN'],
      };
    }

    const candidates = await this.prisma.user.findMany({
      where: userFilter,
      orderBy: { id: 'asc' }, 
    });

    if (candidates.length === 0) {
      return null; 
    }

    const candidateLoads = await Promise.all(
      candidates.map(async (user) => {
        const activeTicketsCount = await this.prisma.ticket.count({
          where: {
            currentAssignedToId: user.id, 
            status: { notIn: ['RESOLVED', 'CLOSED'] }, 
          },
        });
        return { userId: user.id, count: activeTicketsCount };
      })
    );

    candidateLoads.sort((a, b) => a.count - b.count);

    return candidateLoads[0].userId;
  }

  private async findBestAssigneeTx(tx: any, deptCode: string): Promise<number | null> {
    const dept = await tx.department.findUnique({ where: { code: deptCode } });
    if (!dept) return null;
    
    const candidates = await tx.user.findMany({
      where: { departmentId: dept.id, role: { notIn: ['MANAGER', 'SUPER_ADMIN'] } },
      orderBy: { id: 'asc' }, 
    });
    if (candidates.length === 0) return null;

    const candidateLoads = await Promise.all(
      candidates.map(async (u: any) => {
        const count = await tx.ticket.count({
          where: { currentAssignedToId: u.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        });
        return { userId: u.id, count };
      })
    );
    
    candidateLoads.sort((a: any, b: any) => a.count - b.count);
    return candidateLoads[0].userId;
  }

  async getMyPendingTickets(userId: number, role: string) {
    return await this.prisma.ticket.findMany({
      where: {
        OR: [
          {
            assignees: {
              some: {
                userId: userId
              }
            }
          },
          { resolverRole: role.toUpperCase() }
        ]
      },
      include: {
        createdBy: { 
          select: { 
            name: true, 
            role: true 
          } 
        },
        currentAssignedTo: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        assignees: {
          include: {
            user: { select: { id: true, name: true, role: true } }
          }
        }
      },
      orderBy: [
        { urgency: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async getMyCreatedTickets(userId: number) {
    return await this.prisma.ticket.findMany({
      where: {
        createdById: userId, 
      },
      include: {
        currentAssignedTo: { select: { id: true, name: true, role: true } }, 
        assignees: {
          include: {
            user: { select: { id: true, name: true, role: true } }
          }
        }
      },
      orderBy: { 
        createdAt: 'desc' 
      },
    });
  }

  async toggleProgress(ticketId: number, currentStatus: string, actionUserId: number | null) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (currentStatus === 'RESOLVED_TRIGGER') {
      const now = new Date();
      const actualMinutes = Math.round((now.getTime() - new Date(ticket.createdAt).getTime()) / 60000);

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.ticketComment.create({
          data: {
            ticketId,
            authorId: actionUserId || ticket.currentAssignedToId || 1,
            body: `✅ Resolver marked it as resolved.`,
          },
        });

        return tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: 'RESOLVED',
            updatedAt: now,
            actualResolveMinutes: actualMinutes > 0 ? actualMinutes : 1,
            closedAt: now, // Status resolved and closedAt tracking is set simultaneously
          },
        });
      });

      if (ticket.currentAssignedToId) {
        this.syncUserPerformanceMetrics(ticket.currentAssignedToId);
      }
      this.syncDepartmentPerformanceMetrics(ticket.resolvingDepartment);
      return result;
    }

    const nextStatus = ticket.status === 'IN_PROGRESS' ? 'ASSIGNED' : 'IN_PROGRESS';
    
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: actionUserId || ticket.currentAssignedToId || 1,
          body: `⚙️ Ticket status updated from ${ticket.status} to ${nextStatus}.`,
        },
      });

      return tx.ticket.update({
        where: { id: ticketId },
        data: { 
          status: nextStatus,
          updatedAt: new Date()
        },
      });
    });

    if (ticket.currentAssignedToId) {
      this.syncUserPerformanceMetrics(ticket.currentAssignedToId);
    }
    this.syncDepartmentPerformanceMetrics(ticket.resolvingDepartment);
    return result;
  }

  async reassignTicket(
    ticketId: number, 
    userIdWhoClicked: number, 
    type: 'SAME_DEPT' | 'OTHER_DEPT', 
    targetDeptCode?: string, 
    targetUserId?: number
  ) {
    const originalTicket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    
    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: { currentAssignedTo: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const clicker = await tx.user.findUnique({ where: { id: userIdWhoClicked } });
      if (!clicker) throw new NotFoundException('Clicker user nahi mila');

      let nextAssigneeId: number | null = null;
      let targetDeptName = ticket.resolvingDepartment;

      if (type === 'OTHER_DEPT') {
        if (!targetDeptCode) throw new BadRequestException('Department code zaroori hai');
        const dept = await tx.department.findUnique({ where: { code: targetDeptCode } });
        if (!dept) throw new NotFoundException('Target department nahi mila');
        targetDeptName = dept.code;

        nextAssigneeId = await this.findBestAssigneeTx(tx, targetDeptCode);
      } else {
        if (!targetUserId) throw new BadRequestException('Target User ID zaroori hai');
        nextAssigneeId = targetUserId;
      }

      if (!nextAssigneeId) throw new BadRequestException('Koi suitable assignee nahi mila');

      const newAssignee = await tx.user.findUnique({ where: { id: nextAssigneeId } });

      await tx.ticketAssignee.deleteMany({
        where: { ticketId, userId: userIdWhoClicked },
      });

      await tx.ticketAssignee.create({
        data: {
          ticketId,
          userId: nextAssigneeId,
          reassignedFrom: `${clicker.name} (ID: ${clicker.id})`,
        },
      });

      await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: userIdWhoClicked,
          body: `🤖 System Log: Ticket has been reassigned to ${newAssignee?.name} of [${targetDeptName}] department.`,
        },
      });

      return tx.ticket.update({
        where: { id: ticketId },
        data: {
          currentAssignedToId: nextAssigneeId,
          currentReassignedById: userIdWhoClicked,
          routingStatus: 'REASSIGNED',
          resolvingDepartment: targetDeptName,
          status: 'ASSIGNED',
        },
      });
    });

    this.syncUserPerformanceMetrics(userIdWhoClicked);
    if (result.currentAssignedToId) {
      this.syncUserPerformanceMetrics(result.currentAssignedToId);
    }

    // Refresh historical as well as new landing departments counters
    if (originalTicket) {
      this.syncDepartmentPerformanceMetrics(originalTicket.resolvingDepartment);
    }
    this.syncDepartmentPerformanceMetrics(result.resolvingDepartment);

    return result;
  }

  async forwardTicket(ticketId: number, forwarderId: number, targetUserId: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      const forwarder = await tx.user.findUnique({ where: { id: forwarderId } });
      const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!forwarder || !targetUser) throw new NotFoundException('Users data bounds mismatch error.');

      await tx.ticketAssignee.upsert({
        where: { ticketId_userId: { ticketId, userId: targetUserId } },
        update: { forwardedFrom: forwarder.name },
        create: { ticketId, userId: targetUserId, forwardedFrom: forwarder.name },
      });

      await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: forwarderId,
          body: `🤖 System Log: ${forwarder.name} forwarded this ticket to ${targetUser.name}`,
        },
      });

      return tx.ticket.update({
        where: { id: ticketId },
        data: {
          currentAssignedToId: targetUserId,
          currentForwardedById: forwarderId,
          routingStatus: 'FORWARDED',
          status: 'ASSIGNED',
        },
      });
    });

    this.syncUserPerformanceMetrics(forwarderId);
    this.syncUserPerformanceMetrics(targetUserId);
    this.syncDepartmentPerformanceMetrics(result.resolvingDepartment);
    return result;
  }

  async getDeptUsers(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.departmentId) return [];
    return this.prisma.user.findMany({
      where: { departmentId: user.departmentId, id: { not: userId } },
      select: { id: true, name: true, role: true },
    });
  }

  async getAllDepartments() {
    return this.prisma.department.findMany({ select: { id: true, name: true, code: true } });
  }

  async revertTicket(ticketId: number, clickerId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('Ticket nahi mila');

    const currentUserId = ticket.currentAssignedToId;
    const clicker = await this.prisma.user.findUnique({ where: { id: clickerId } });

    let finalResult: any;

    if (currentUserId) {
      const currentAssignment = await this.prisma.ticketAssignee.findUnique({
        where: {
          ticketId_userId: { ticketId, userId: currentUserId },
        },
      });

      if (currentAssignment && currentAssignment.forwardedFrom) {
        let previousAssigneeId: number | null = null;
        let prevUser: any = null;

        const numericId = Number(currentAssignment.forwardedFrom);
        if (!isNaN(numericId)) {
          previousAssigneeId = numericId;
          prevUser = await this.prisma.user.findFirst({ where: { id: previousAssigneeId } });
        } else {
          prevUser = await this.prisma.user.findFirst({
            where: { name: currentAssignment.forwardedFrom },
          });
          if (prevUser) {
            previousAssigneeId = prevUser.id;
          }
        }

        if (previousAssigneeId && prevUser) {
          const prevAssignment = await this.prisma.ticketAssignee.findUnique({
            where: {
              ticketId_userId: { ticketId, userId: previousAssigneeId },
            },
          });

          let nextBackForwardedFromId: number | null = null;
          if (prevAssignment && prevAssignment.forwardedFrom) {
            const nextNumericId = Number(prevAssignment.forwardedFrom);
            if (!isNaN(nextNumericId)) {
              nextBackForwardedFromId = nextNumericId;
            } else {
              const nextBackUser = await this.prisma.user.findFirst({
                where: { name: prevAssignment.forwardedFrom },
              });
              if (nextBackUser) nextBackForwardedFromId = nextBackUser.id;
            }
          }

          const txResults = await this.prisma.$transaction([
            this.prisma.ticketAssignee.update({
              where: {
                ticketId_userId: { ticketId, userId: previousAssigneeId },
              },
              data: {
                revertedFrom: String(clickerId),
              },
            }),
            this.prisma.ticket.update({
              where: { id: ticketId },
              data: {
                currentAssignedToId: previousAssigneeId,
                currentForwardedById: nextBackForwardedFromId ? nextBackForwardedFromId : null,
                routingStatus: 'REVERTED',
                currentRevertedById: clickerId,
                status: ticket.status === 'IN_PROGRESS' ? 'ASSIGNED' : ticket.status,
              },
            }),
            this.prisma.ticketComment.create({
              data: {
                ticketId,
                authorId: clickerId,
                body: `🔄 Ticket reverted. Assigned to: [${prevUser.name}]. Reverted by: ${clicker?.name || 'System'}.`,
              },
            }),
          ]);

          finalResult = { message: 'Reverted back successfully' };
          
          if (currentUserId) this.syncUserPerformanceMetrics(currentUserId);
          if (previousAssigneeId) this.syncUserPerformanceMetrics(previousAssigneeId);
          this.syncDepartmentPerformanceMetrics(ticket.resolvingDepartment);
          
          return finalResult;
        }
      }
    }

    await this.prisma.$transaction([
      ...(currentUserId
        ? [
            this.prisma.ticketAssignee.update({
              where: {
                ticketId_userId: { ticketId, userId: currentUserId },
              },
              data: {
                revertedFrom: String(clickerId),
              },
            }),
          ]
        : []),
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          currentAssignedToId: null, 
          currentForwardedById: null,
          routingStatus: 'REVERTED',
          currentRevertedById: clickerId,
          status: ticket.status === 'IN_PROGRESS' ? 'OPEN' : ticket.status, 
        },
      }),
      this.prisma.ticketComment.create({
        data: {
          ticketId,
          authorId: clickerId,
          body: `🔄 Ticket is directly reverted to creater because no forward traces found. Reverted by: ${clicker?.name || 'System'}.`,
        },
      }),
    ]);

    if (currentUserId) this.syncUserPerformanceMetrics(currentUserId);
    this.syncDepartmentPerformanceMetrics(ticket.resolvingDepartment);

    return { message: 'Reverted to creator safely without data loss' };
  }

  async closeTicket(ticketId: number, clickerId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('Ticket nahi mila');
    if (ticket.status === 'IN_PROGRESS' || ticket.status === 'CLOSED') {
      throw new BadRequestException('In-progress ya closed ticket ko close nahi kiya ja sakta');
    }

    const now = new Date();
    const actualMinutes = Math.round((now.getTime() - new Date(ticket.createdAt).getTime()) / 60000);

    const result = await this.prisma.$transaction(async (tx) => {
      const clicker = await tx.user.findUnique({ where: { id: clickerId } });
      await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: clickerId,
          body: `🔒 Ticket is permanently closed by creator [${clicker?.name || 'System'}] .`,
        },
      });

      return tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'CLOSED',
          closedById: clickerId,
          closedAt: now,
          actualResolveMinutes: actualMinutes > 0 ? actualMinutes : 1,
          updatedAt: now,
        },
      });
    });

    if (ticket.currentAssignedToId) {
      this.syncUserPerformanceMetrics(ticket.currentAssignedToId);
    }
    this.syncDepartmentPerformanceMetrics(result.resolvingDepartment);
    return result;
  }

  async reopen(ticketId: number, clickerId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId }
    });
    
    if (!ticket) throw new NotFoundException('Ticket nahi mili');
    if (ticket.status !== 'RESOLVED') {
      throw new BadRequestException('Sirf RESOLVED tickets ko hi reopen kiya ja sakta hai');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.ticketComment.create({
        data: {
          ticketId: ticketId,
          authorId: clickerId, 
          body: `🔄 Ticket reopened.`,
        },
      });

      return await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'ASSIGNED',
          updatedAt: new Date(),
          closedAt: null, 
        },
      });
    });

    if (ticket.currentAssignedToId) {
      this.syncUserPerformanceMetrics(ticket.currentAssignedToId);
    }
    this.syncDepartmentPerformanceMetrics(result.resolvingDepartment);
    return result;
  }

  private getWorkingMinutesElapsed(resolvedAt: Date, now: Date): number {
    let current = new Date(resolvedAt.getTime());
    let elapsedMinutes = 0;

    while (current < now) {
      const day = current.getDay();
      
      if (day === 6 || day === 0) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
        continue;
      }

      const dayStart = new Date(current.getTime()).setHours(9, 0, 0, 0);
      const dayEnd = new Date(current.getTime()).setHours(18, 0, 0, 0);

      if (current.getTime() < dayStart) {
        current.setHours(9, 0, 0, 0);
        continue;
      }
      if (current.getTime() >= dayEnd) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
        continue;
      }

      current.setMinutes(current.getMinutes() + 1);
      elapsedMinutes++;
    }

    return elapsedMinutes;
  }

  @Cron('0 */15 * * * *')
  async handleAutoCloseResolvedTickets() {
    const now = new Date();
    const resolvedTickets = await this.prisma.ticket.findMany({
      where: { status: 'RESOLVED' }
    });

    for (const ticket of resolvedTickets) {
      const resolvedTime = ticket.updatedAt || ticket.createdAt;
      const workingMinutesPassed = this.getWorkingMinutesElapsed(new Date(resolvedTime), now);

      if (workingMinutesPassed >= 120) {
        const actualMinutes = Math.round((now.getTime() - new Date(ticket.createdAt).getTime()) / 60000);

        await this.prisma.$transaction(async (tx) => {
          await tx.ticketComment.create({
            data: {
              ticketId: ticket.id,
              authorId: 1, 
              body: `🤖 Auto-SLA Engine: Client did not take action within 2 Working Hours. Ticket automatically CLOSED.`,
            },
          });

          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: 'CLOSED',
              closedById: 1,
              closedAt: now,
              actualResolveMinutes: actualMinutes > 0 ? actualMinutes : 1,
              updatedAt: now,
            },
          });
        });

        if (ticket.currentAssignedToId) {
          this.syncUserPerformanceMetrics(ticket.currentAssignedToId);
        }
        this.syncDepartmentPerformanceMetrics(ticket.resolvingDepartment);
      }
    }
  }

  private async syncUserPerformanceMetrics(userId: number) {
    try {
      const now = new Date();
      const currentPeriod = `${now.toLocaleString('en-US', { month: 'long' }).toUpperCase()}_${now.getFullYear()}`;

      const assignments = await this.prisma.ticketAssignee.findMany({
        where: { userId: userId },
        include: { ticket: true },
      });

      const processedTickets = assignments.map((a) => a.ticket);

      let ticketsAssignedTotal = processedTickets.length;
      let assignedCriticalCount = 0;
      let assignedHighCount = 0;
      let assignedMediumCount = 0;
      let assignedLowCount = 0;

      let ticketsClosedTotal = 0;
      let closedInTimeTotal = 0;
      let closedAfterDeadline = 0;

      let activeWorkloadTotal = 0;
      let activeWorkloadBreached = 0;

      let inTimeCriticalCount = 0;
      let inTimeHighCount = 0;
      let inTimeMediumCount = 0;
      let inTimeLowCount = 0;

      let afterDeadlineCriticalCount = 0;
      let afterDeadlineHighCount = 0;
      let afterDeadlineMediumCount = 0;
      let afterDeadlineLowCount = 0;

      for (const ticket of processedTickets) {
        const priority = (ticket.priority || 'MEDIUM').toUpperCase();

        if (priority === 'CRITICAL') assignedCriticalCount++;
        else if (priority === 'HIGH') assignedHighCount++;
        else if (priority === 'MEDIUM') assignedMediumCount++;
        else if (priority === 'LOW') assignedLowCount++;

        const isClosedState = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

        if (isClosedState) {
          ticketsClosedTotal++;
          
          const resolutionTime = ticket.closedAt || ticket.updatedAt || now;
          const targetDeadline = new Date(ticket.deadlineAt);
          const isInTime = resolutionTime.getTime() <= targetDeadline.getTime();

          if (isInTime) {
            closedInTimeTotal++;
            if (priority === 'CRITICAL') inTimeCriticalCount++;
            else if (priority === 'HIGH') inTimeHighCount++;
            else if (priority === 'MEDIUM') inTimeMediumCount++;
            else if (priority === 'LOW') inTimeLowCount++;
          } else {
            closedAfterDeadline++;
            if (priority === 'CRITICAL') afterDeadlineCriticalCount++;
            else if (priority === 'HIGH') afterDeadlineHighCount++;
            else if (priority === 'MEDIUM') afterDeadlineMediumCount++;
            else if (priority === 'LOW') afterDeadlineLowCount++;
          }
        } else {
          activeWorkloadTotal++;
          const targetDeadline = new Date(ticket.deadlineAt);
          
          if (now.getTime() > targetDeadline.getTime()) {
            activeWorkloadBreached++;
          }
        }
      }

      await this.prisma.employeePerformance.upsert({
        where: {
          employeeId_period: {
            employeeId: userId,
            period: currentPeriod,
          },
        },
        update: {
          ticketsAssignedTotal,
          assignedCriticalCount,
          assignedHighCount,
          assignedMediumCount,
          assignedLowCount,
          ticketsClosedTotal,
          closedInTimeTotal,
          closedAfterDeadline,
          activeWorkloadTotal,
          activeWorkloadBreached,
          inTimeCriticalCount,
          inTimeHighCount,
          inTimeMediumCount,
          inTimeLowCount,
          afterDeadlineCriticalCount,
          afterDeadlineHighCount,
          afterDeadlineMediumCount,
          afterDeadlineLowCount,
        },
        create: {
          employeeId: userId,
          period: currentPeriod,
          ticketsAssignedTotal,
          assignedCriticalCount,
          assignedHighCount,
          assignedMediumCount,
          assignedLowCount,
          ticketsClosedTotal,
          closedInTimeTotal,
          closedAfterDeadline,
          activeWorkloadTotal,
          activeWorkloadBreached,
          inTimeCriticalCount,
          inTimeHighCount,
          inTimeMediumCount,
          inTimeLowCount,
          afterDeadlineCriticalCount,
          afterDeadlineHighCount,
          afterDeadlineMediumCount,
          afterDeadlineLowCount,
        },
      });
    } catch (err) {
      console.error(`❌ Performance tracking hook sync failed for user ${userId}:`, err);
    }
  }

  // 🏢 ==================== NEW METRIC CALCULATOR METHOD FOR DEPARTMENT PERFORMANCE ====================
  private async syncDepartmentPerformanceMetrics(deptCode: string) {
    try {
      if (!deptCode) return;
      const now = new Date();
      const currentPeriod = 'JULY_2026';

      const department = await this.prisma.department.findUnique({
        where: { code: deptCode.toUpperCase() },
      });
      if (!department) return;

      // Fetch all tickets targeting this department currently
      const allDeptTickets = await this.prisma.ticket.findMany({
        where: { resolvingDepartment: deptCode },
      });

      let ticketsAssignedTotal = allDeptTickets.length;
      let assignedCriticalCount = 0;
      let assignedHighCount = 0;
      let assignedMediumCount = 0;
      let assignedLowCount = 0;

      let ticketsResolvedTotal = 0;
      let resolvedCriticalCount = 0;
      let resolvedHighCount = 0;
      let resolvedMediumCount = 0;
      let resolvedLowCount = 0;

      let closedInTimeTotal = 0;
      let inTimeCriticalCount = 0;
      let inTimeHighCount = 0;
      let inTimeMediumCount = 0;
      let inTimeLowCount = 0;

      let closedAfterDeadlineTotal = 0;
      let afterDeadlineCriticalCount = 0;
      let afterDeadlineHighCount = 0;
      let afterDeadlineMediumCount = 0;
      let afterDeadlineLowCount = 0;

      let currentWorkingTotal = 0;
      let currentWorkingBreachedTotal = 0;

      for (const ticket of allDeptTickets) {
        const priority = (ticket.priority || 'MEDIUM').toUpperCase();

        // Count assigned splits
        if (priority === 'CRITICAL') assignedCriticalCount++;
        else if (priority === 'HIGH') assignedHighCount++;
        else if (priority === 'MEDIUM') assignedMediumCount++;
        else if (priority === 'LOW') assignedLowCount++;

        // Resolved State Calculation
        const isResolved = ticket.status === 'RESOLVED' && ticket.closedAt !== null;

        if (isResolved) {
          ticketsResolvedTotal++;
          if (priority === 'CRITICAL') resolvedCriticalCount++;
          else if (priority === 'HIGH') resolvedHighCount++;
          else if (priority === 'MEDIUM') resolvedMediumCount++;
          else if (priority === 'LOW') resolvedLowCount++;

          // 2 Working Hours SLA Check logic addition
          const resolutionTime = new Date(ticket.closedAt!);
          const computedSlaMaxLimit = this.calculateSlaDeadline(new Date(ticket.deadlineAt), 120); 

          if (resolutionTime.getTime() <= computedSlaMaxLimit.getTime()) {
            closedInTimeTotal++;
            if (priority === 'CRITICAL') inTimeCriticalCount++;
            else if (priority === 'HIGH') inTimeHighCount++;
            else if (priority === 'MEDIUM') inTimeMediumCount++;
            else if (priority === 'LOW') inTimeLowCount++;
          } else {
            closedAfterDeadlineTotal++;
            if (priority === 'CRITICAL') afterDeadlineCriticalCount++;
            else if (priority === 'HIGH') afterDeadlineHighCount++;
            else if (priority === 'MEDIUM') afterDeadlineMediumCount++;
            else if (priority === 'LOW') afterDeadlineLowCount++;
          }
        } else {
          // Current work scope analysis (not in RESOLVED or CLOSED)
          if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
            currentWorkingTotal++;
            const computedSlaMaxLimit = this.calculateSlaDeadline(new Date(ticket.deadlineAt), 120);
            if (now.getTime() > computedSlaMaxLimit.getTime()) {
              currentWorkingBreachedTotal++;
            }
          }
        }
      }

      await this.prisma.departmentPerformance.upsert({
        where: {
          departmentId_period: {
            departmentId: department.id,
            period: currentPeriod,
          },
        },
        update: {
          ticketsAssignedTotal,
          assignedCriticalCount,
          assignedHighCount,
          assignedMediumCount,
          assignedLowCount,
          ticketsResolvedTotal,
          resolvedCriticalCount,
          resolvedHighCount,
          resolvedMediumCount,
          resolvedLowCount,
          closedInTimeTotal,
          inTimeCriticalCount,
          inTimeHighCount,
          inTimeMediumCount,
          inTimeLowCount,
          closedAfterDeadlineTotal,
          afterDeadlineCriticalCount,
          afterDeadlineHighCount,
          afterDeadlineMediumCount,
          afterDeadlineLowCount,
          currentWorkingTotal,
          currentWorkingBreachedTotal,
        },
        create: {
          departmentId: department.id,
          period: currentPeriod,
          ticketsAssignedTotal,
          assignedCriticalCount,
          assignedHighCount,
          assignedMediumCount,
          assignedLowCount,
          ticketsResolvedTotal,
          resolvedCriticalCount,
          resolvedHighCount,
          resolvedMediumCount,
          resolvedLowCount,
          closedInTimeTotal,
          inTimeCriticalCount,
          inTimeHighCount,
          inTimeMediumCount,
          inTimeLowCount,
          closedAfterDeadlineTotal,
          afterDeadlineCriticalCount,
          afterDeadlineHighCount,
          afterDeadlineMediumCount,
          afterDeadlineLowCount,
          currentWorkingTotal,
          currentWorkingBreachedTotal,
        },
      });
    } catch (error) {
      console.error(`❌ Department Performance tracking computation failed for code ${deptCode}:`, error);
    }
  }
}