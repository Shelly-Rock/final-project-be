import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RemoveStudentReqDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  hardDelete?: number;
}
