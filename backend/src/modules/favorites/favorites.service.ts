import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserFavorite } from './user-favorite.entity';
import { Post } from '../posts/post.entity';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectRepository(UserFavorite)
    private readonly favoritesRepository: Repository<UserFavorite>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly dataSource: DataSource,
  ) {}

  async favoritePost(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt || post.status === 'hidden') {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.favoritesRepository.findOne({
      where: { userId, postId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Already favorited this post',
        error: 'ALREADY_FAVORITED',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const fav = manager.create(UserFavorite, { userId, postId });
      await manager.save(fav);
      await manager.increment(Post, { id: postId }, 'favoriteCount', 1);

      const updated = await manager.findOne(Post, { where: { id: postId } });
      this.logger.log(`Post favorited: postId=${postId}, userId=${userId}`);
      return { isFavorited: true, favoriteCount: updated!.favoriteCount };
    });
  }

  async unfavoritePost(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt || post.status === 'hidden') {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.favoritesRepository.findOne({
      where: { userId, postId },
    });
    if (!existing) {
      throw new NotFoundException('Not favorited');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.remove(existing);
      await manager.decrement(Post, { id: postId }, 'favoriteCount', 1);

      const updated = await manager.findOne(Post, { where: { id: postId } });
      this.logger.log(`Post unfavorited: postId=${postId}, userId=${userId}`);
      return { isFavorited: false, favoriteCount: updated!.favoriteCount };
    });
  }

  async isFavorited(userId: string, postId: string): Promise<boolean> {
    const fav = await this.favoritesRepository.findOne({
      where: { userId, postId },
    });
    return !!fav;
  }
}
