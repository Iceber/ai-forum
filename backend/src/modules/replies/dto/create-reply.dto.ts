import { IsString, IsOptional, IsIn, IsUUID, MinLength } from 'class-validator';

export class CreateReplyDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsIn(['plaintext', 'markdown'])
  contentType?: 'plaintext' | 'markdown';

  @IsOptional()
  @IsUUID()
  parentReplyId?: string;
}
