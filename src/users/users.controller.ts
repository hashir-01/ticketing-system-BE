import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Ip } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  async login(@Body() body: any, @Ip() ip: string) { // 👈 2. Yahan @Ip() ip: string inject kiya
    return this.usersService.login(body, ip);        // 👈 3. Aur ip service ko pass kar di
  }

  @Post('create') // Endpoint mapped to: POST /users/create
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  @Patch(':id')
  updateUser(
    @Param('id') id: string, 
    @Body() updateData: { role?: string; departmentId?: number; password?: string }
  ) {
    return this.usersService.updateUser(Number(id), updateData);
  }

  @Delete(':id')
  removeUser(@Param('id') id: string) {
    return this.usersService.removeUser(Number(id));
  }
}