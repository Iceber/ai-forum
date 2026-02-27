import { IsString, IsIn, MaxLength } from 'class-validator';

export class PresignDto {
  @IsString()
  @MaxLength(255)
  filename: string;

  @IsIn(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  contentType: string;
}
