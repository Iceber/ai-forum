import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Bar } from '../bars/bar.entity';
import { User } from '../users/user.entity';
import { Reply } from '../replies/reply.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bar_id' })
  barId: string;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'content_type', length: 20, default: 'plaintext' })
  contentType: 'plaintext' | 'markdown';

  @Column({ name: 'reply_count', default: 0 })
  replyCount: number;

  @Column({ name: 'last_reply_at', type: 'timestamptz', nullable: true })
  lastReplyAt: Date | null;

  @Column({ length: 20, default: 'published' })
  status: 'published' | 'hidden' | 'deleted' | 'under_review';

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Bar, (bar) => bar.posts)
  @JoinColumn({ name: 'bar_id' })
  bar: Bar;

  @ManyToOne(() => User, (user) => user.posts)
  @JoinColumn({ name: 'author_id' })
  author: User;

  @OneToMany(() => Reply, (reply) => reply.post)
  replies: Reply[];
}
