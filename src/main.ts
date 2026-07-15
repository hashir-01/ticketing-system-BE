import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. Global Security Headers (Helmet)
  app.use(helmet());
  
  // 2. CORS configured for frontend communication
  app.enableCors({
    origin: '*', // Jab aap frontend deploy karlein, to '*' ki jagah exact frontend URL daal dena (e.g., 'https://my-app.vercel.app')
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // 3. Global Validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  
  // 4. Port assignment for cloud (Render uses process.env.PORT)
  const port = process.env.PORT || 3001;
  await app.listen(port);
}
bootstrap();