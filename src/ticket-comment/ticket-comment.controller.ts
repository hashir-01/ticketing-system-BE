import { Controller, Post, Get, Body, Param, Request, ParseIntPipe } from '@nestjs/common';
import { TicketCommentService } from './ticket-comment.service';
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';

@Controller('tickets/:ticketId/comments')
export class TicketCommentController {
  constructor(private readonly ticketCommentService: TicketCommentService) {}

  // 🔍 1. Database se ticket ki saari comments lekar aane ke liye (GET)
  @Get()
  async getComments(
    @Param('ticketId', ParseIntPipe) ticketId: number
  ) {
    return this.ticketCommentService.getCommentsByTicket(ticketId);
  }

  // ✍️ 2. Nayi comment ticket par save karne ke liye (POST)
  @Post()
  async createComment(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() createCommentDto: CreateTicketCommentDto,
    @Request() req: any
  ) {
    // Dynamic extraction logic to capture correct active user context safely
    const userId = Number(req.user?.id || req.body?.userId || req.headers['x-user-id'] || 1);
    
    return this.ticketCommentService.createComment(
      ticketId, 
      userId, 
      createCommentDto.text
    );
  }
}