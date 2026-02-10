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
  SharedConfigService,
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
    private readonly sharedConfig: SharedConfigService,
  ) {}

  private async getDefaultCompanyForUser(userId: string): Promise<Company | null> {
    return this.companyRepository.findOne({
      where: { ownerId: userId },
      order: { createdAt: 'ASC' },
    });
  }

  async ensureDefaultWorkspace(
    userId: string,
    displayName?: string,
  ): Promise<Company | null> {
    const existing = await this.companyRepository.findOne({
      where: { ownerId: userId },
      order: { createdAt: 'ASC' },
    });
    if (existing) return existing;

    const name = displayName?.trim()
      ? `${displayName.trim()}'s Workspace`
      : 'My Workspace';

    const company = this.companyRepository.create({
      name,
      ownerId: userId,
    });
    await this.companyRepository.save(company);

    const now = new Date();
    await this.companyMemberRepository.save(
      this.companyMemberRepository.create({
        companyId: company.id,
        userId,
        role: CompanyMemberRole.OWNER,
        joinedAt: now,
      }),
    );
    return company;
  }

  async getMyCompanies(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      role: string;
      isOwner: boolean;
    }>
  > {
    const members = await this.companyMemberRepository.find({
      where: { userId },
      relations: ['company'],
      order: { joinedAt: 'ASC' },
    });
    const result = members
      .filter((m) => m.company != null)
      .map((m) => ({
        id: m.company!.id,
        name: m.company!.name,
        role: m.role,
        isOwner: m.company!.ownerId === userId,
      }));
    result.sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return result;
  }

  async getInvitePreview(token: string): Promise<{
    companyName: string;
    inviterName: string;
    role: string;
  }> {
    const invite = await this.companyInviteRepository.findOne({
      where: { inviteToken: token.trim() },
      relations: ['company', 'invitedByUser'],
    });
    if (!invite) {
      throw new HttpException(
        { code: 'INVITE_NOT_FOUND', message: 'Invite not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (invite.expiresAt <= new Date()) {
      throw new HttpException(
        { code: 'INVITE_EXPIRED', message: 'Invite has expired' },
        HttpStatus.GONE,
      );
    }
    return {
      companyName: invite.company?.name ?? '',
      inviterName: invite.invitedByUser?.username ?? '',
      role: invite.role,
    };
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
      .orderBy('cm.joinedAt', 'ASC')
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
    role: CompanyMemberRole,
    name?: string,
  ): Promise<{ success: true; inviteToken: string; inviteUrl: string }> {
    const company = await this.getDefaultCompanyForUser(userId);
    if (!company) {
      throw new HttpException(
        { code: 'INSUFFICIENT_PERMISSIONS', message: 'No workspace found' },
        HttpStatus.FORBIDDEN,
      );
    }
    const member = await this.companyMemberRepository.findOne({
      where: { companyId: company.id, userId },
    });
    if (!member || (member.role !== CompanyMemberRole.OWNER && member.role !== CompanyMemberRole.ADMIN)) {
      throw new HttpException(
        {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only Owners and Admins can invite team members',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const inviteToken = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
    await this.companyInviteRepository.save(
      this.companyInviteRepository.create({
        companyId: company.id,
        email: null,
        inviteeDisplayName: name?.trim() || null,
        role,
        inviteToken,
        invitedBy: userId,
        expiresAt,
      }),
    );
    const baseUrl =
      this.sharedConfig.discord.frontendBaseUrl ?? 'http://localhost:3010';
    const inviteUrl = `${baseUrl.replace(/\/$/, '')}/invite/${inviteToken}`;
    return { success: true, inviteToken, inviteUrl };
  }

  async acceptInvite(
    userId: string,
    inviteToken: string,
  ): Promise<{ companyId: string; companyName: string }> {
    const invite = await this.companyInviteRepository.findOne({
      where: { inviteToken: inviteToken.trim() },
      relations: ['company'],
    });
    if (!invite) {
      throw new HttpException(
        { code: 'INVITE_NOT_FOUND', message: 'Invite not found or already used' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (invite.expiresAt <= new Date()) {
      throw new HttpException(
        { code: 'INVITE_EXPIRED', message: 'Invite has expired' },
        HttpStatus.GONE,
      );
    }
    const existingMember = await this.companyMemberRepository.findOne({
      where: { companyId: invite.companyId, userId },
    });
    if (existingMember) {
      throw new HttpException(
        { code: 'ALREADY_TEAM_MEMBER', message: 'You are already a member of this team' },
        HttpStatus.CONFLICT,
      );
    }
    const now = new Date();
    await this.companyMemberRepository.save(
      this.companyMemberRepository.create({
        companyId: invite.companyId,
        userId,
        role: invite.role,
        joinedAt: now,
      }),
    );
    await this.companyInviteRepository.remove(invite);
    return {
      companyId: invite.company?.id ?? invite.companyId,
      companyName: invite.company?.name ?? '',
    };
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
        { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only Owners can change roles' },
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
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Cannot remove yourself or insufficient permissions',
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
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Cannot remove yourself or insufficient permissions',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    if (currentMember.role !== CompanyMemberRole.OWNER && member.role === CompanyMemberRole.OWNER) {
      throw new HttpException(
        {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Cannot remove yourself or insufficient permissions',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    await this.companyMemberRepository.remove(member);
    return { success: true };
  }
}
