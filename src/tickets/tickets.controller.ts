import { Controller, Post, Body, Get, Req, Query, Param, ParseIntPipe } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('pending')
  async getPendingTickets(@Req() req: any) {
    const userId = Number(req.headers['x-user-id'] || 6); 
    const userRole = req.headers['x-user-role'] || 'IAM';

    return this.ticketsService.getMyPendingTickets(userId, userRole);
  }

  @Post('create')
  async create(@Body() body: any) {
    const creatorUser = {
      id: Number(body.creatorId || 6), 
      role: body.creatorRole || 'IAM',  
    };

    const { creatorId, creatorRole, ...createTicketDto } = body;
    return this.ticketsService.createTicket(createTicketDto as CreateTicketDto, creatorUser);
  }

  @Get('my-creations')
  async getMyCreations(@Query('userId') userId: string) {
    const parsedId = Number(userId || 6);
    return this.ticketsService.getMyCreatedTickets(parsedId);
  }

  @Post(':id/toggle-progress')
  async toggleProgress(
    @Param('id', ParseIntPipe) id: number, 
    @Body('currentStatus') currentStatus: string,
    @Body('userId') userId: any
  ) {
    const actionUserId = userId ? Number(userId) : null;
    return this.ticketsService.toggleProgress(id, currentStatus, actionUserId);
  }

  @Get('meta/departments')
  async getDepartments() {
    return this.ticketsService.getAllDepartments();
  }

  @Get('meta/dept-users/:userId')
  async getDeptUsers(@Param('userId', ParseIntPipe) userId: number) {
    return this.ticketsService.getDeptUsers(userId);
  }

  @Post(':id/reassign')
  async reassign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { clickerId: number; type: 'SAME_DEPT' | 'OTHER_DEPT'; deptCode?: string; targetUserId?: number }
  ) {
    return this.ticketsService.reassignTicket(id, body.clickerId, body.type, body.deptCode, body.targetUserId);
  }

  @Post(':id/forward')
  async forward(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { forwarderId: number; targetUserId: number }
  ) {
    return this.ticketsService.forwardTicket(id, body.forwarderId, body.targetUserId);
  }

  @Post(':id/revert')
  async revertTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body('clickerId', ParseIntPipe) clickerId: number,
  ) {
    return this.ticketsService.revertTicket(id, clickerId);
  }

  @Post(':id/close')
  async closeTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body('clickerId', ParseIntPipe) clickerId: number,
  ) {
    return this.ticketsService.closeTicket(id, clickerId);
  }

  @Post(':id/reopen')
async reopenTicket(
  @Param('id') id: string,
  @Body('clickerId') clickerId: number,
) {
  return await this.ticketsService.reopen(Number(id), clickerId);
}
}