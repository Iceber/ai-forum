import { IsOptional, IsString, MaxLength } from 'class-validator';

export class HideContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
