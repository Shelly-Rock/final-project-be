import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailModule } from '@/modules/email';
import { CoreAuthModule } from '@/core/auth/auth.module';

@Module({
  imports: [
    EmailModule,
    CoreAuthModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
