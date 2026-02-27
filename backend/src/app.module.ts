import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BarsModule } from './modules/bars/bars.module';
import { PostsModule } from './modules/posts/posts.module';
import { RepliesModule } from './modules/replies/replies.module';
import { AdminModule } from './modules/admin/admin.module';
import { LikesModule } from './modules/likes/likes.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { User } from './modules/users/user.entity';
import { Bar } from './modules/bars/bar.entity';
import { BarMember } from './modules/bars/bar-member.entity';
import { Post } from './modules/posts/post.entity';
import { Reply } from './modules/replies/reply.entity';
import { AdminAction } from './modules/admin/admin-action.entity';
import { UserLike } from './modules/likes/user-like.entity';
import { UserFavorite } from './modules/favorites/user-favorite.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const baseConfig = {
          type: 'postgres' as const,
          entities: [User, Bar, BarMember, Post, Reply, AdminAction, UserLike, UserFavorite],
          synchronize: false,
          logging: configService.get<string>('NODE_ENV') === 'development',
        };

        if (databaseUrl) {
          return {
            ...baseConfig,
            url: databaseUrl,
          };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_DATABASE', 'ai_forum'),
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    BarsModule,
    PostsModule,
    RepliesModule,
    AdminModule,
    LikesModule,
    FavoritesModule,
    UploadsModule,
  ],
})
export class AppModule {}
