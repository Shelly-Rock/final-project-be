import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

@Module({
  providers: [LoggerMiddleware, LoggingInterceptor, TransformInterceptor],
  exports: [LoggerMiddleware, LoggingInterceptor, TransformInterceptor],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
