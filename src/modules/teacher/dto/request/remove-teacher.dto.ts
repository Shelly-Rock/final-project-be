import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class RemoveTeacherDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  codes!: string[];
}
