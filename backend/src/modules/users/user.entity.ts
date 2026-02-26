import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Bar } from '../bars/bar.entity';
import { BarMember } from '../bars/bar-member.entity';
import { Post } from '../posts/post.entity';
import { Reply } from '../replies/reply.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ length: 100 })
  nickname: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ length: 20, default: 'user' })
  role: 'user' | 'admin';

  @Column({ name: 'token_version', default: 0 })
  tokenVersion: number;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'auth_provider', length: 50, default: 'local' })
  authProvider: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Bar, (bar) => bar.createdBy)
  bars: Bar[];

  @OneToMany(() => BarMember, (bm) => bm.user)
  barMemberships: BarMember[];

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Reply, (reply) => reply.author)
  replies: Reply[];
}
