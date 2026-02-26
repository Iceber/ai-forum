import { IsString, IsNumber, Min, Max, MinLength } from 'class-validator';

export class SuspendBarDto {
  @IsString()
  @MinLength(1)
  reason: string;

  @IsNumber()
  @Min(1)
  @Max(720)
  duration: number;
}
