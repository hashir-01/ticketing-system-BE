import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketCommentService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔍 1. Fetch comments
  async getCommentsByTicket(ticketId: number) {
    return await this.prisma.ticketComment.findMany({
      where: { ticketId: ticketId },
      include: {
        author: { 
          select: { name: true, role: true } 
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  // ✍️ 2. Create comment with strict ID enforcement
  async createComment(ticketId: number, userId: any, text: string) {
    // Force clean numeric parsing
    const numericUserId = Number(userId);

    if (!numericUserId || isNaN(numericUserId)) {
      throw new BadRequestException('Comment creation failed: A valid numerical User ID must be provided.');
    }

    const ticketExists = await this.prisma.ticket.findUnique({
      where: { id: ticketId }
    });
    
    if (!ticketExists) {
      throw new NotFoundException(`Ticket with ID #${ticketId} not found.`);
    }

    const userExists = await this.prisma.user.findUnique({
      where: { id: numericUserId },
    });

    if (!userExists) {
      throw new NotFoundException(`User with ID #${numericUserId} does not exist in the database. Cannot assign author foreign key.`);
    }

    return await this.prisma.ticketComment.create({
      data: {
        ticketId: ticketId,
        authorId: userExists.id, 
        body: text,
      },
      include: {
        author: { 
          select: { name: true, role: true } 
        }
      }
    });
  }
}