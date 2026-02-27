import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Post } from '../posts/post.entity';
import { Reply } from '../replies/reply.entity';
import { BarMember } from '../bars/bar-member.entity';
import { Bar } from '../bars/bar.entity';
import { UserFavorite } from '../favorites/user-favorite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Post, Reply, BarMember, Bar, UserFavorite])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
