import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { Reply } from '../replies/reply.entity';
import { Bar } from '../bars/bar.entity';
import { BarMember } from '../bars/bar-member.entity';
import { UserLike } from '../likes/user-like.entity';
import { UserFavorite } from '../favorites/user-favorite.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Reply, Bar, BarMember, UserLike, UserFavorite]),
  ],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
