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
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async findAll(
    @Query('barId') barId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.postsService.findAll(barId, cursor, parsedLimit);
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id ?? undefined;
    return this.postsService.findOne(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreatePostDto, @CurrentUser() user: User) {
    return this.postsService.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.postsService.deletePost(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/share')
  async share(@Param('id') id: string) {
    return this.postsService.sharePost(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/hide')
  async hide(@Param('id') id: string, @CurrentUser() user: User) {
    return this.postsService.hidePost(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/unhide')
  async unhide(@Param('id') id: string, @CurrentUser() user: User) {
    return this.postsService.unhidePost(id, user.id);
  }
}
