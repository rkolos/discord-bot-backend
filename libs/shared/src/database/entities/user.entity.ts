import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum UserPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum UserStatus {
  ACTIVE = 'active',
  BANNED = 'banned',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'discord_id', type: 'text', unique: true, nullable: true })
  discordId: string | null;

  @Column({ name: 'username', type: 'text' })
  username: string;

  @Column({ name: 'discriminator', type: 'text', nullable: true })
  discriminator: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'email', type: 'text', unique: true, nullable: true })
  email: string | null;

  @Column({
    name: 'plan',
    type: 'text',
    enum: UserPlan,
  })
  plan: UserPlan;

  @Column({
    name: 'status',
    type: 'text',
    enum: UserStatus,
  })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
