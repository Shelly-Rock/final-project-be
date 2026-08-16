import { PartialType } from '@nestjs/swagger';
import { CreateRegistrationPeriodDto } from './create-registration-period.dto';

export class UpdateRegistrationPeriodDto extends PartialType(
  CreateRegistrationPeriodDto,
) {}
