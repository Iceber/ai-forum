import { IsString, IsUUID, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsUUID()
  barId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsIn(['plaintext', 'markdown'])
  contentType?: 'plaintext' | 'markdown';
}
