import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum CompanyMemberRole {
  OWNER = 'Owner',
  ADMIN = 'Admin',
  MEMBER = 'Member',
}

@Entity('company_members')
export class CompanyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'role',
    type: 'text',
    enum: CompanyMemberRole,
  })
  role: CompanyMemberRole;

  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;
}
