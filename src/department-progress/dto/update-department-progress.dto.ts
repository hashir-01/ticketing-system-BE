import { PartialType } from '@nestjs/mapped-types';
import { CreateDepartmentProgressDto } from './create-department-progress.dto';

export class UpdateDepartmentProgressDto extends PartialType(CreateDepartmentProgressDto) {}
