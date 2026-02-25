import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';

@Entity('replies')
export class Reply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id' })
  postId: string;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column({ name: 'parent_reply_id', nullable: true })
  parentReplyId: string | null;

  @Column({ name: 'floor_number', type: 'int' })
  floorNumber: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'content_type', length: 20, default: 'plaintext' })
  contentType: 'plaintext' | 'markdown';

  @Column({ length: 20, default: 'published' })
  status: 'published' | 'hidden' | 'deleted' | 'under_review';

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Post, (post) => post.replies)
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => User, (user) => user.replies)
  @JoinColumn({ name: 'author_id' })
  author: User;

  @ManyToOne(() => Reply, { nullable: true })
  @JoinColumn({ name: 'parent_reply_id' })
  parentReply: Reply | null;
}
