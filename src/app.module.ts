import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module'; // 1. IMPORT IT HERE
import { DepartmentModule } from './department/department.module';
import { TicketsModule } from './tickets/tickets.module';
import { TicketCommentModule } from './ticket-comment/ticket-comment.module';
import { EmployeePerformanceModule } from './employee-performance/employee-performance.module';
import { DepartmentProgressModule } from './department-progress/department-progress.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, // 2. ADD IT TO THE IMPORTS ARRAY
    UsersModule, DepartmentModule, TicketsModule, TicketCommentModule, EmployeePerformanceModule, DepartmentProgressModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}