import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet'; // 👈 1. Yeh import add kiya

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(helmet()); // 👈 2. Yeh line add ki (Global Security Headers ke liye)
  
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();