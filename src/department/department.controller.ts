import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentService.create(createDepartmentDto);
  }

  // 1. Route for fetching all departments (GET /department)
  @Get()
  findAll() {
    return this.departmentService.findAll();
  }

  // 2. Route for deleting a department (DELETE /department/:id)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}