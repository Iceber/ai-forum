import { IsString, MinLength } from 'class-validator';

export class CloseBarDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
