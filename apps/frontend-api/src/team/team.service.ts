import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import {
  Company,
  CompanyMember,
  CompanyInvite,
  User,
  CompanyMemberRole,
} from '@app/shared';

const INVITE_TOKEN_BYTES = 32;
const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    @InjectRepository(CompanyInvite)
    private readonly companyInviteRepository: Repository<CompanyInvite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async getDefaultCompanyForUser(userId: string): Promise<Company | null> {
    return this.companyRepository.findOne({
      where: { ownerId: userId },
      order: { createdAt: 'ASC' },
    });
  }

  async getTeamMembers(
    userId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{
    data: Array<{
      id: string;
      name: string;
      email: string | null;
      avatar: string | null;
      role: string;
      joinedAt: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const company = await this.getDefaultCompanyForUser(userId);
    if (!company) {
      return {
        data: [],
        meta: { total: 0, page: 1, limit, totalPages: 0 },
      };
    }
    const qb = this.companyMemberRepository
      .createQueryBuilder('cm')
      .leftJoinAndSelect('cm.user', 'u')
      .where('cm.company_id = :companyId', { companyId: company.id });
    if (search && search.trim()) {
      qb.andWhere(
        '(u.username ILIKE :search OR u.email ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }
    const [members, total] = await qb
      .orderBy('cm.joined_at', 'ASC')
      .skip((Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit)))
      .take(Math.min(100, Math.max(1, limit)))
      .getManyAndCount();
    const data = members.map((m) => ({
      id: m.id,
      name: m.user?.username ?? '',
      email: m.user?.email ?? null,
      avatar: m.user?.avatarUrl ?? null,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));
    const take = Math.min(100, Math.max(1, limit));
    const totalPages = Math.ceil(total / take) || 1;
    return {
      data,
      meta: { total, page: Math.max(1, page), limit: take, totalPages },
    };
  }

  async inviteTeamMember(
    userId: string,
    email: string,
    role: CompanyMemberRole,
  ): Promise<{ success: true; inviteToken: string }> {
    const company = await this.getDefaultCompanyForUser(userId);
    if (!company) {
      throw new HttpException(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No workspace found',
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const member = await this.companyMemberRepository.findOne({
      where: { companyId: company.id, userId },
    });
    if (!member || (member.role !== CompanyMemberRole.OWNER && member.role !== CompanyMemberRole.ADMIN)) {
      throw new HttpException(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only Owners and Admins can invite team members',
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const normalizedEmail = email.toLowerCase().trim();
    const inviteToken = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
    await this.companyInviteRepository.save(
      this.companyInviteRepository.create({
        companyId: company.id,
        email: normalizedEmail,
        role,
        inviteToken,
        invitedBy: userId,
        expiresAt,
      }),
    );
    return { success: true, inviteToken };
  }

  async updateTeamMemberRole(
    userId: string,
    memberId: string,
    role: CompanyMemberRole,
  ): Promise<{
    id: string;
    name: string;
    email: string | null;
    avatar: string | null;
    role: string;
    joinedAt: string;
  }> {
    const company = await this.getDefaultCompanyForUser(userId);
    if (!company) {
      throw new NotFoundException({
        code: 'TEAM_MEMBER_NOT_FOUND',
        message: 'Team member not found',
      });
    }
    const ownerMember = await this.companyMemberRepository.findOne({
      where: { companyId: company.id, userId },
    });
    if (!ownerMember || ownerMember.role !== CompanyMemberRole.OWNER) {
      throw new HttpException(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only Owners can change roles',
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const member = await this.companyMemberRepository.findOne({
      where: { id: memberId, companyId: company.id },
      relations: ['user'],
    });
    if (!member) {
      throw new NotFoundException({
        code: 'TEAM_MEMBER_NOT_FOUND',
        message: 'Team member not found',
      });
    }
    member.role = role;
    await this.companyMemberRepository.save(member);
    return {
      id: member.id,
      name: member.user?.username ?? '',
      email: member.user?.email ?? null,
      avatar: member.user?.avatarUrl ?? null,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  async removeTeamMember(
    userId: string,
    memberId: string,
  ): Promise<{ success: true }> {
    const company = await this.getDefaultCompanyForUser(userId);
    if (!company) {
      throw new NotFoundException({
        code: 'TEAM_MEMBER_NOT_FOUND',
        message: 'Team member not found',
      });
    }
    const currentMember = await this.companyMemberRepository.findOne({
      where: { companyId: company.id, userId },
    });
    if (!currentMember || currentMember.role === CompanyMemberRole.MEMBER) {
      throw new HttpException(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Cannot remove yourself or insufficient permissions',
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const member = await this.companyMemberRepository.findOne({
      where: { id: memberId, companyId: company.id },
    });
    if (!member) {
      throw new NotFoundException({
        code: 'TEAM_MEMBER_NOT_FOUND',
        message: 'Team member not found',
      });
    }
    if (member.userId === userId) {
      throw new HttpException(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Cannot remove yourself or insufficient permissions',
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
    if (currentMember.role !== CompanyMemberRole.OWNER && member.role === CompanyMemberRole.OWNER) {
      throw new HttpException(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Cannot remove yourself or insufficient permissions',
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
    await this.companyMemberRepository.remove(member);
    return { success: true };
  }
}
