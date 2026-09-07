import { Global, Module } from '@nestjs/common';
import { DeadlinePolicyService } from './deadline-policy.service';

@Global()
@Module({
  providers: [DeadlinePolicyService],
  exports: [DeadlinePolicyService],
})
export class GovernanceModule {}
