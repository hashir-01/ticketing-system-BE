import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateTicketCommentDto {
  @IsNotEmpty({ message: 'Comment text cannot be empty' })
  @IsString()
  @MinLength(1)
  text: string;
}