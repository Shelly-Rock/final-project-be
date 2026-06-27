import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  BadRequestException,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, SwaggerDocumentOptions } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  app.setGlobalPrefix('api/v1');

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

  app.useGlobalGuards(new JwtAuthGuard(reflector));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Final Project API')
    .setDescription(`
# API Documentation

Welcome to the Final Project API documentation.

## Overview
RESTful API built with NestJS for the final project backend.

## Authentication
This API uses JWT (JSON Web Token) for authentication.

### How to Authenticate:
1. Register a new account via \`POST /auth/register\`
2. Login to get JWT token via \`POST /auth/login\`
3. Include the token in the Authorization header:
   \`Authorization: Bearer <your-jwt-token>\`

## User Roles
- **USER**: Standard user with basic access
- **ADMIN**: Administrator with full access

## Common Response Codes
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

## Rate Limiting
Rate limiting is not currently implemented. Use responsibly.

---
**Base URL:** \`http://localhost:3000/api/v1\`
**Swagger UI:** \`http://localhost:3000/api/docs\`
    `)
    .setVersion('1.0.0')
    .setContact(
      'API Support',
      'https://github.com/your-repo',
      'support@example.com'
    )
    .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter your JWT token',
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
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Users', 'User management - Admin/Secretary can CRUD users')
    .addTag('Departments', 'Academic department management')
    .addTag('Majors', 'Major/Specialization management')
    .addTag('Classes', 'Class management')
    .addTag('Courses', 'Course/Academic year management')
    .addTag('Thesis Topics', 'Thesis topic management - Create, approve, assign')
    .addTag('Registrations', 'Student topic registration and teacher approval')
    .addTag('Reports', 'Export Excel reports - Users, Topics, Registrations')
    .addTag('Deadline Settings', 'Registration deadline management')
    .addTag('Health', 'Service health check endpoints')
    .build();

  const documentOptions: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  };

  const document = SwaggerModule.createDocument(app, swaggerConfig, documentOptions);
  
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

  const port = configService.get<number>('PORT') || 3000;

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
