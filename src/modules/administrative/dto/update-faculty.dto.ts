import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateFacultyDto } from './create-faculty.dto';

export class UpdateFacultyDto extends PartialType(
  OmitType(CreateFacultyDto, ['id'] as const),
) {}
