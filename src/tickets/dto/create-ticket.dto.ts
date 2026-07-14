import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  impact: string; // "HIGH", "MEDIUM", "LOW"

  @IsNotEmpty()
  @IsString()
  urgency: string; // "HIGH", "MEDIUM", "LOW"

  @IsNotEmpty()
  @IsString()
  resolvingDepartment: string; // e.g., "IAM"

  @IsOptional()
  @IsString()
  resolverRole?: string; // e.g., "IAM", "MANAGER"
}