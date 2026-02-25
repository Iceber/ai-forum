import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class QueryBarsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
