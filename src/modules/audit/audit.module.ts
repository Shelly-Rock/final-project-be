import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@core/database/prisma/prisma.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
