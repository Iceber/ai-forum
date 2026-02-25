import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Bar } from './bar.entity';
import { User } from '../users/user.entity';

@Entity('bar_members')
@Unique(['barId', 'userId'])
export class BarMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bar_id' })
  barId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 20, default: 'member' })
  role: 'member' | 'moderator' | 'owner';

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Bar, (bar) => bar.members)
  @JoinColumn({ name: 'bar_id' })
  bar: Bar;

  @ManyToOne(() => User, (user) => user.barMemberships)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
