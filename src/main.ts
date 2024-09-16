import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { json } from 'express';

const SOCKET_TRANSFER_LIMIT = 10 * 1e6; // Web Socket max transfer size 10MB
const JSON_LIMIT = '10mb'; // Parser - JSON - max transfer size 10MB

class CustomIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      maxHttpBufferSize: SOCKET_TRANSFER_LIMIT, // max transfer size 10MB
    });
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new CustomIoAdapter(app));
  app.setGlobalPrefix('api', { exclude: ['/'] });
  const PORT = process.env.PORT ?? 3000;

  app.use(json({ limit: JSON_LIMIT }));

  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({
    origin: process.env.CLIENT_URL ?? `http://localhost:5173`,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('RippleLink Api')
    .setDescription(
      'REST Api and Socket Gateway for RippleLink - Real-Time Communication',
    )
    .setVersion('1.0')
    .build();

  const options: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  };

  const document = SwaggerModule.createDocument(app, config, options);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      requestInterceptor: (req) => {
        req.credentials = 'include';
        return req;
      },
    },
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css',
    ],
  });

  await app.listen(
    PORT,
    '0.0.0.0',
    () => console.log`"Running on PORT ${PORT}`,
  );
}
bootstrap();
