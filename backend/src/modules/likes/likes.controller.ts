import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('posts/:id/like')
  @HttpCode(201)
  async likePost(@Param('id') id: string, @CurrentUser() user: User) {
    return this.likesService.likePost(id, user.id);
  }

  @Delete('posts/:id/like')
  async unlikePost(@Param('id') id: string, @CurrentUser() user: User) {
    return this.likesService.unlikePost(id, user.id);
  }

  @Post('replies/:id/like')
  @HttpCode(201)
  async likeReply(@Param('id') id: string, @CurrentUser() user: User) {
    return this.likesService.likeReply(id, user.id);
  }

  @Delete('replies/:id/like')
  async unlikeReply(@Param('id') id: string, @CurrentUser() user: User) {
    return this.likesService.unlikeReply(id, user.id);
  }
}
