import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export default function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Final Project API')
    .setDescription('API Documentation')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);
}
