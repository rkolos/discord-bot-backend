import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { AdminUser } from './admin-user.entity';

@Entity('activity_log')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'admin_user_id', type: 'uuid', nullable: true })
  adminUserId: string | null;

  @ManyToOne(() => AdminUser, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser: AdminUser | null;

  @Column({ name: 'action', type: 'text' })
  action: string;

  @Column({ name: 'details', type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
