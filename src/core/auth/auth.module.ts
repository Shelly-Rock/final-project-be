import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';

@Global()
@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.access.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.access.expiresIn'),
        },
      }),
    }),
  ],

  providers: [JwtStrategy],

  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
