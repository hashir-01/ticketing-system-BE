import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: 'ankaramessiankaramessi', // Use an env variable in production
      signOptions: { expiresIn: '1d' },   // Token lasts 24 hours
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
