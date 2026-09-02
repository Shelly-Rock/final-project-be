import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  BadRequestException,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerDocumentOptions,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from '@core/exceptions/http-exception.filter';
import { RateLimitMiddleware } from '@core/middleware/rateLimit.middleware';
import { env } from 'process';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const reflector = app.get(Reflector);

  const apiPrefix = configService.get<string>('API_PREFIX') ?? 'api';
  const apiVersion = configService.get<string>('API_VERSION') ?? 'v1';

  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        }));
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: messages,
        });
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
    ],
    exposedHeaders: ['Authorization'],
    maxAge: 86400,
  });

  // Apply rate limiting middleware for sensitive endpoints
  const rateLimitMiddleware = new RateLimitMiddleware(60000, 100); // 100 requests per minute for general endpoints
  const strictRateLimitMiddleware = new RateLimitMiddleware(60000, 20); // 20 requests per minute for sensitive auth endpoints
  
  app.use((req, res, next) => {
    // Apply stricter rate limiting to sensitive auth endpoints
    if (req.path.includes('/auth/login') || 
        req.path.includes('/auth/register') || 
        req.path.includes('/auth/forgot-password') ||
        req.path.includes('/auth/resend-verification')) {
      return strictRateLimitMiddleware.use(req, res, next);
    }
    return rateLimitMiddleware.use(req, res, next);
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Final Project API')
    .setDescription(
      `
# API Documentation

Welcome to the Final Project API documentation.

## Overview
RESTful API built with NestJS for the QTQ project backend.

## User Roles
- **USER**: Standard user with basic access
- **ADMIN**: Administrator with full access

---
**Base URL:** \`http://localhost:3000/api/v1\`
**Swagger UI:** \`http://localhost:3000/api/docs\`
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        description: 'Optional API key for additional security',
        in: 'header',
      },
      'api-key',
    )
    .build();

  const documentOptions: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  };

  const document = SwaggerModule.createDocument(
    app,
    swaggerConfig,
    documentOptions,
  );

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        theme: 'tomorrow-night',
      },
    },
    customSiteTitle: 'Final Project API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 2.5em; }
      .swagger-ui .info .description { font-size: 1.2em; }
    `,
    customJs: `
      // Custom JS for Swagger UI enhancements
    `,
  });

  const port = configService.get<number>('PORT') || 3001;

  await app.listen(port);
  console.log('=================================================');
  console.log('  Application is running on:');
  console.log(`  http://localhost:${port}`);
  console.log('  Swagger Documentation:');
  console.log(`  http://localhost:${port}/api/docs`);
  console.log('  API Base URL:');
  console.log(`  http://localhost:${port}/api/v1`);
  console.log('=================================================');
}

bootstrap();
