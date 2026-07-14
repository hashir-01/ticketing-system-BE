import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketCommentDto } from './create-ticket-comment.dto';

export class UpdateTicketCommentDto extends PartialType(CreateTicketCommentDto) {}
