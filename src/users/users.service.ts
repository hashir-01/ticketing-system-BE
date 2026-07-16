import { Injectable, UnauthorizedException, ConflictException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'; 
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// 🔒 Memory-Based IP Tracker (Undisturbed)
interface LockInfo {
  failedAttempts: number;
  lockUntil: number | null;
}
const loginAttemptsTracker: Record<string, LockInfo> = {};

@Injectable()
export class UsersService {
  // 🔑 Hardcoded application credential structure
  private readonly DEFAULT_PASSWORD = 'ticketFlowemployee';

  // 🌐 Supabase Configuration Credentials
  // 💡 Recommendation: Inko baad mein variables standard (.env) par shift kar lena.
  private readonly SUPABASE_URL = 'https://wjupsxavdmnvlgjyfuws.supabase.co'; // 👈 Apna Supabase Project URL yahan lagayein
  private readonly SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdXBzeGF2ZG1udmxnanlmdXdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODgxODcsImV4cCI6MjA5OTY2NDE4N30.i5ZhQnHGrNVaxXAZnxGvyjFuEOBcExLJYPCwfm5iM3s';         // 👈 Apni Supabase Anon Key yahan lagayein

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  // 📧 Supabase Integration via native HTTPS API (Safe from port blocks)
  private async sendCredentialsEmail(email: string, name: string, role: string, isReset = false) {
    try {
      // 📤 Supabase built-in auth logic ko request hit karega taake automatic template trigger ho
      const response = await fetch(`${this.SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Supabase Auth API responded with error');
      }

      console.log(`📧 Supabase welcome verification workflow initialized for: ${email}`);
      
      // 💡 Custom HTML Note:
      // Kyunki hum Supabase ka platform channel directly utilize kar rahe hain, 
      // aap apne Supabase Dashboard -> Authentication -> Emails -> Templates mein ja kar
      // "Reset Password" ya "Confirm Signup" template ke andar yeh text aur design daal dein:
      /*
        <h2>Welcome to the team, {{ .User.user_metadata.name }}!</h2>
        <p>Your corporate workspace profile configuration has been successfully generated.</p>
        <p><strong>Temporary Access Key:</strong> ticketFlowemployee</p>
        <p style="color: red; font-weight: bold;">
          ⚠️ Security Alert: This temporary credential configuration is NOT safe. 
          Kindly change your password inside your profile layout immediately right after your first login.
        </p>
        <br/>
        <a href="{{ .ConfirmationURL }}">Click here to verify and complete authentication layout setup</a>
      */
    } catch (error) {
      console.error(`❌ Supabase default channel failed to transmit email to ${email}:`, error);
    }
  }

  // 🛡️ User Authentication Security Gateway (Undisturbed)
  async login(body: any, ipAddress = '127.0.0.1') {
    const { email, password } = body;

    const trackingKey = ipAddress;
    if (!loginAttemptsTracker[trackingKey]) {
      loginAttemptsTracker[trackingKey] = { failedAttempts: 0, lockUntil: null };
    }

    const currentTracker = loginAttemptsTracker[trackingKey];

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

    if (!user) {
      currentTracker.failedAttempts += 1;
      if (currentTracker.failedAttempts >= 20) {
        currentTracker.lockUntil = Date.now() + 15 * 60 * 1000;
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      currentTracker.failedAttempts += 1;
      if (currentTracker.failedAttempts >= 20) {
        currentTracker.lockUntil = Date.now() + 15 * 60 * 1000;
      }
      throw new UnauthorizedException('Invalid email or password');
    }

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

  // ➕ Create User Pipeline (Updated with hardcoded password and Supabase dispatch)
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

    // 📩 Supabase trigger system call instead of nodemailer
    await this.sendCredentialsEmail(email.toLowerCase(), name, role.toUpperCase(), false);

    const saltRounds = 10;
    // 🔑 Hamesha "ticketFlowemployee" ka bcrypt hash generate kar k save karega
    const hashedPassword = await bcrypt.hash(this.DEFAULT_PASSWORD, saltRounds);

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

  // ✏️ Update User Flow (Updated password tracking trigger)
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
      
      // ✅ Triggers Supabase standard verification sequence for updates
      await this.sendCredentialsEmail(user.email, user.name, updateData.role || user.role, true);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      include: { department: true }
    });

    const { password: _, ...result } = updatedUser;
    return result;
  }

  // ❌ Remove User Flow (Undisturbed)
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