import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { CompanyMemberRole } from './company-member.entity';

@Entity('company_invites')
export class CompanyInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'email', type: 'text', nullable: true })
  email: string | null;

  @Column({ name: 'invitee_display_name', type: 'text', nullable: true })
  inviteeDisplayName: string | null;

  @Column({
    name: 'role',
    type: 'text',
    enum: CompanyMemberRole,
  })
  role: CompanyMemberRole;

  @Column({ name: 'invite_token', type: 'text', unique: true })
  inviteToken: string;

  @Column({ name: 'invited_by', type: 'uuid' })
  invitedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'invited_by' })
  invitedByUser: User;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
