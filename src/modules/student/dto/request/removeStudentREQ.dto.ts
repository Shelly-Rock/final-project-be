import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RemoveStudentReqDTO {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  ids!: number[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hardDelete?: boolean;
}
