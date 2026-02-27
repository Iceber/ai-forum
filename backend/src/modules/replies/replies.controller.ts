import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { RepliesService } from './replies.service';
import { CreateReplyDto } from './dto/create-reply.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller()
export class RepliesController {
  constructor(private readonly repliesService: RepliesService) {}

  @UseGuards(OptionalAuthGuard)
  @Get('posts/:postId/replies')
  async findAll(
    @Param('postId') postId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const userId = req?.user?.id ?? undefined;
    return this.repliesService.findByPost(postId, cursor, parsedLimit, userId);
  }

  @UseGuards(OptionalAuthGuard)
  @Get('replies/:replyId/children')
  async findChildren(
    @Param('replyId') replyId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const userId = req?.user?.id ?? undefined;
    return this.repliesService.findChildren(replyId, cursor, parsedLimit, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/replies')
  async create(
    @Param('postId') postId: string,
    @Body() dto: CreateReplyDto,
    @CurrentUser() user: User,
  ) {
    return this.repliesService.create(postId, dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('replies/:id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.repliesService.deleteReply(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('replies/:id/hide')
  async hide(@Param('id') id: string, @CurrentUser() user: User) {
    return this.repliesService.hideReply(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('replies/:id/unhide')
  async unhide(@Param('id') id: string, @CurrentUser() user: User) {
    return this.repliesService.unhideReply(id, user.id);
  }
}
