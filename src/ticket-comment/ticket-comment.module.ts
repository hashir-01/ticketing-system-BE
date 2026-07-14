import { Module } from '@nestjs/common';
import { TicketCommentService } from './ticket-comment.service';
import { TicketCommentController } from './ticket-comment.controller';

@Module({
  controllers: [TicketCommentController],
  providers: [TicketCommentService],
})
export class TicketCommentModule {}
