import { IsIn } from 'class-validator';

export class ChangeRoleDto {
  @IsIn(['member', 'moderator'])
  role: 'member' | 'moderator';
}
