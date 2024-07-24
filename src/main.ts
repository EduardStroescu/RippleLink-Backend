import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CLIENT_URL ?? `http://localhost:5173`,
    credentials: true,
    // allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept',
    // methods: 'GET,PUT,PATCH,POST,DELETE,UPDATE,OPTIONS',
  });
  // app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('api');

  await app.listen(3000);
}
bootstrap();
