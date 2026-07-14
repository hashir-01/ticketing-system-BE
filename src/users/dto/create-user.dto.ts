import { IsNotEmpty, IsString, IsEmail, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  cnic: string;

  @IsString() 
  @IsNotEmpty()
  role: string;

  @IsNumber()
  @IsNotEmpty()
  departmentId: number;

  @IsString()
  @IsNotEmpty()
  targetDepartment: string;
}