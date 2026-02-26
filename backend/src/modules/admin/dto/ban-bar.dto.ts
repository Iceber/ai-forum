import { IsString, MinLength } from 'class-validator';

export class BanBarDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
