import { IsString, IsOptional, IsUrl, MinLength, MaxLength } from 'class-validator';

export class CreateBarDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rules?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
