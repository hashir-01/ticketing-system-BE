import 'dotenv/config'; // Ensures environment variables are parsed instantly
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Create a native PostgreSQL connection pool using your connection string directly
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL || "postgresql://postgres:hashir16@localhost:5432/ticketing_system?schema=public" 
    });
    
    // Wrap the pool inside Prisma's driver adapter layer
    const adapter = new PrismaPg(pool);

    // Forward the driver adapter down to the core engine constructor
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('🚀 Success! Connected smoothly to the PostgreSQL Database via Prisma 7 Adapter.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}