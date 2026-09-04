import { ArrayMinSize, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RemoveStudentReqDTO {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  ids!: number[];
}
