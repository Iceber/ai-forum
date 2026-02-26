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

  @Column({ length: 20, default: 'pending_review' })
  status:
    | 'pending_review'
    | 'active'
    | 'rejected'
    | 'suspended'
    | 'permanently_banned'
    | 'closed';

  // Records the reason for moderation decisions (rejection, suspension, ban)
  @Column({ name: 'status_reason', type: 'text', nullable: true })
  statusReason: string | null;

  @Column({ name: 'suspend_until', type: 'timestamptz', nullable: true })
  suspendUntil: Date | null;

  // Denormalized counter; updated by BarMember join/leave operations to avoid COUNT queries
  @Column({ name: 'member_count', type: 'int', default: 0 })
  memberCount: number;

  @Column({ name: 'created_by' })
  createdById: string;

  @ManyToOne(() => User, (user) => user.bars)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => BarMember, (bm) => bm.bar)
  members: BarMember[];

  @OneToMany(() => Post, (post) => post.bar)
  posts: Post[];
}
