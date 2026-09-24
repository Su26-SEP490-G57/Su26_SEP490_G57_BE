/* eslint-disable @typescript-eslint/no-floating-promises */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
import { AppModule } from './app.module';
import { CaseTransformInterceptor } from './common/interceptors/case-transform.interceptor';
import { TimezoneInterceptor } from './common/interceptors/timezone.interceptor';
import { IoAdapter } from '@nestjs/platform-socket.io';

process.env.TZ = 'Asia/Ho_Chi_Minh';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable WebSocket support (required cho real-time features: audit logs, alerts)
  app.useWebSocketAdapter(new IoAdapter(app));

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
    : [];

  // CORS cho HTTP requests
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Apply timezone interceptor globally
  app.useGlobalInterceptors(new TimezoneInterceptor());

  // Apply case transform interceptor to convert snake_case to camelCase
  app.useGlobalInterceptors(new CaseTransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Capstone API')
    .setDescription('Ride Sharing API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
