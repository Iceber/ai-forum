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
import { User } from '../users/user.entity';
import { BarMember } from './bar-member.entity';
import { Post } from '../posts/post.entity';

@Entity('bars')
export class Bar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  rules: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ length: 20, default: 'active' })
  status: 'active' | 'archived';

  @Column({ name: 'created_by' })
  createdById: string;

  @ManyToOne(() => User, (user) => user.bars)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => BarMember, (bm) => bm.bar)
  members: BarMember[];

  @OneToMany(() => Post, (post) => post.bar)
  posts: Post[];
}
