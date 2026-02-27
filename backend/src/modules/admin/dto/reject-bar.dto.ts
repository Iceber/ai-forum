import { IsString, MinLength } from 'class-validator';

export class RejectBarDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
