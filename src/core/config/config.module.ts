import { Module, Global } from '@nestjs/common';
import jwtConfig from './jwt.config';
import mailConfig from './mail.config';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, mailConfig],
      envFilePath: '.env',
      expandVariables: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
