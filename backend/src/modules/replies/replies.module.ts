import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reply } from './reply.entity';
import { RepliesService } from './replies.service';
import { RepliesController } from './replies.controller';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reply]), PostsModule],
  providers: [RepliesService],
  controllers: [RepliesController],
})
export class RepliesModule {}
