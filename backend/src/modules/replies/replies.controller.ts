import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RepliesService } from './replies.service';
import { CreateReplyDto } from './dto/create-reply.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('posts/:postId/replies')
export class RepliesController {
  constructor(private readonly repliesService: RepliesService) {}

  @Get()
  async findAll(
    @Param('postId') postId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.repliesService.findByPost(postId, cursor, parsedLimit);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Param('postId') postId: string,
    @Body() dto: CreateReplyDto,
    @CurrentUser() user: User,
  ) {
    return this.repliesService.create(postId, dto, user.id);
  }
}
