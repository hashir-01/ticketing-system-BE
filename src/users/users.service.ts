import { Injectable, UnauthorizedException, ConflictException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import * as bcrypt from 'bcrypt'; 
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// 🔒 Memory-Based IP Tracker (Function ke bahaar RAM mein save rahega, database undisturbed hai)
interface LockInfo {
  failedAttempts: number;
  lockUntil: number | null;
}
const loginAttemptsTracker: Record<string, LockInfo> = {};

@Injectable()
export class UsersService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'studentcyber763@gmail.com',
        pass: 'jmpsaglerxfonsru',
      },
    });
  }

  private generateSecurePassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const part1 = uppercase[Math.floor(Math.random() * uppercase.length)];
    const part2 = specials[Math.floor(Math.random() * specials.length)];
    const part3 = numbers[Math.floor(Math.random() * numbers.length)];
    
    const allPool = lowercase + numbers + specials;
    let part4 = '';
    for (let i = 0; i < 5; i++) {
      part4 += allPool[Math.floor(Math.random() * allPool.length)];
    }

    return part1 + part4 + part2 + part3;
  }

  private async sendCredentialsEmail(email: string, name: string, password: string, role: string, isReset = false) {
    const mailOptions = {
      from: '"Virevon" <your-email@gmail.com>',
      to: email,
      subject: isReset ? `Password Reset Security Notification` : `Welcome to the team, ${name}!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #334155; max-width: 550px; line-height: 1.6;">
          <h2 style="color: #0f172a; margin-bottom: 4px;">Virevon Security Operations</h2>
          <p style="color: #64748b; margin-top: 0; font-size: 14px;">
            ${isReset ? 'Your account access credentials have been updated.' : 'Your corporate workstation profile is ready.'}
          </p>
          <p>Hi ${name},</p>
          <p>${isReset ? 'Your account password has been administratively reset. Use the temporary secure token below to sign back in:' : 'An internal profile has been established for your network node. Details below:'}</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <table style="width: 100%; font-size: 14px;">
              <tr><td style="width: 120px; font-weight: bold; padding: 4px 0;">ID:</td><td style="color: #0f172a;">${email}</td></tr>
              <tr><td style="font-weight: bold; padding: 4px 0;">Assignment:</td><td style="color: #0f172a;">${role}</td></tr>
              <tr><td style="font-weight: bold; padding: 4px 0;">New Key:</td><td style="color: #0f172a; font-family: monospace; font-weight: bold; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${password}</td></tr>
            </table>
          </div>
          <p style="font-size: 13px;">Please update this credential configuration immediately inside your security profile portal layout.</p>
          <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 24px 0;">
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">Virevon Global Systems • Security & Identity Access Control</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Notification credentials safely dispatched to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to transmit automation dispatch to ${email}:`, error);
    }
  }

  // 🛡️ Note: body ke saath optional ip parameters receive kiye taake request object se exact client trace ho sake
  async login(body: any, ipAddress = '127.0.0.1') {
    const { email, password } = body;

    // 1. Memory tracking context initialize kijiye
    const trackingKey = ipAddress;
    if (!loginAttemptsTracker[trackingKey]) {
      loginAttemptsTracker[trackingKey] = { failedAttempts: 0, lockUntil: null };
    }

    const currentTracker = loginAttemptsTracker[trackingKey];

    // 2. Lock check: Agar browser memory block state mein hai toh code aage hit hi nahi karega
    if (currentTracker.lockUntil && currentTracker.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((currentTracker.lockUntil - Date.now()) / 60000);
      throw new HttpException(
        `Too many failed login attempts. This terminal has been locked out. Try again in ${remainingMinutes} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }, 
      include: { department: true }
    });

    // ❌ CASE A: User data nahi mila (Failed attempt logger trigger)
    if (!user) {
      currentTracker.failedAttempts += 1;
      if (currentTracker.failedAttempts >= 20) {
        currentTracker.lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins block array matrix
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // ❌ CASE B: Password galat hai (Failed attempt logger trigger)
    if (!isPasswordValid) {
      currentTracker.failedAttempts += 1;
      if (currentTracker.failedAttempts >= 20) {
        currentTracker.lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins block array matrix
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // ✅ CASE C: Login bilkul pass ho gaya! Reset tracking parameters instantly
    delete loginAttemptsTracker[trackingKey];

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      department: user.department?.name || '' 
    };

    return {
      message: 'Login successful!',
      authToken: this.jwtService.sign(payload), 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department?.name || '', 
      },
    };
  }

  async createUser(createUserDto: CreateUserDto) {
    const { name, email, cnic, role, departmentId } = createUserDto;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { cnic: cnic }
        ]
      }
    });

    if (existingUser) throw new ConflictException('A user with this email or CNIC already exists.');

    const departmentExists = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!departmentExists) throw new NotFoundException(`Department with ID ${departmentId} does not exist.`);

    const autoGeneratedPassword = this.generateSecurePassword();
    
    await this.sendCredentialsEmail(email.toLowerCase(), name, autoGeneratedPassword, role.toUpperCase(), false);

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(autoGeneratedPassword, saltRounds);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          cnic,
          role: role.toUpperCase(), 
          password: hashedPassword, 
          departmentId: departmentId,
        },
        include: { department: true }
      });

      const now = new Date();
      const currentPeriod = `${now.toLocaleString('en-US', { month: 'long' }).toUpperCase()}_${now.getFullYear()}`;

      await tx.employeePerformance.create({
        data: {
          employeeId: user.id,
          period: currentPeriod,
        }
      });

      return user;
    });

    const { password: _, ...result } = newUser;
    return {
      message: 'User created successfully! Performance profile initialized.',
      user: result
    };
  }

  async findAll(search?: string) {
    return this.prisma.user.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      include: { department: true },
    });
  }

  async updateUser(id: number, updateData: { role?: string; departmentId?: number; password?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found.`);

    const dataToUpdate: any = {};
    if (updateData.role) dataToUpdate.role = updateData.role.toUpperCase();
    if (updateData.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: updateData.departmentId } });
      if (!dept) throw new NotFoundException(`Department with ID ${updateData.departmentId} does not exist.`);
      dataToUpdate.departmentId = updateData.departmentId;
    }
    
    if (updateData.password && updateData.password.trim() !== '') {
      const plainPassword = updateData.password;
      const saltRounds = 10;
      dataToUpdate.password = await bcrypt.hash(plainPassword, saltRounds);
      
      await this.sendCredentialsEmail(user.email, user.name, plainPassword, updateData.role || user.role, true);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      include: { department: true }
    });

    const { password: _, ...result } = updatedUser;
    return result;
  }

  async removeUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found.`);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.employeePerformance.deleteMany({
          where: { employeeId: id }
        });

        await tx.user.delete({
          where: { id }
        });
      });

      return { message: 'User account and historical performance tracks removed successfully' };
    } catch (error) {
      console.error(`❌ User delete karne mein database level par error aya:`, error);
      throw new ConflictException('User delete nahi ho saka, shayad yeh kisi aur record (tickets/tasks) ke sath linked hai.');
    }
  }
}