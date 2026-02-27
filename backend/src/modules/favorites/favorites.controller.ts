import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':id/favorite')
  @HttpCode(201)
  async favorite(@Param('id') id: string, @CurrentUser() user: User) {
    return this.favoritesService.favoritePost(id, user.id);
  }

  @Delete(':id/favorite')
  async unfavorite(@Param('id') id: string, @CurrentUser() user: User) {
    return this.favoritesService.unfavoritePost(id, user.id);
  }
}
