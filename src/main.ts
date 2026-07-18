/* eslint-disable @typescript-eslint/no-floating-promises */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
import { AppModule } from './app.module';
import { TimezoneInterceptor } from './common/interceptors/timezone.interceptor';

process.env.TZ = 'Asia/Ho_Chi_Minh';

process.env.TZ = 'Asia/Ho_Chi_Minh';

async function bootstrap() {
  console.log('Hello world');

  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
    : [];

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
