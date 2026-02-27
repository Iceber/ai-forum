import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reply } from './reply.entity';
import { Post } from '../posts/post.entity';
import { Bar } from '../bars/bar.entity';
import { BarMember } from '../bars/bar-member.entity';
import { UserLike } from '../likes/user-like.entity';
import { RepliesService } from './replies.service';
import { RepliesController } from './replies.controller';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reply, Post, Bar, BarMember, UserLike]),
    PostsModule,
  ],
  providers: [RepliesService],
  controllers: [RepliesController],
})
export class RepliesModule {}
