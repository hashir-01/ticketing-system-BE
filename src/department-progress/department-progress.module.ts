import { Module } from '@nestjs/common';
import { DepartmentProgressService } from './department-progress.service';
import { DepartmentProgressController } from './department-progress.controller';

@Module({
  controllers: [DepartmentProgressController],
  providers: [DepartmentProgressService],
})
export class DepartmentProgressModule {}
