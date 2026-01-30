import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  UserPlan,
  SubscriptionPlan,
  UsageLimits,
  PlanLimits,
  Invoice,
  PricePeriod,
} from '@app/shared';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(UsageLimits)
    private readonly usageLimitsRepository: Repository<UsageLimits>,
    @InjectRepository(PlanLimits)
    private readonly planLimitsRepository: Repository<PlanLimits>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async getSubscription(userId: string): Promise<{
    id: string;
    name: string;
    price: number;
    pricePeriod: 'month' | 'year';
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException();
    const planId = user.plan;
    const plan = await this.planRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      return {
        id: planId,
        name: planId,
        price: 0,
        pricePeriod: 'month',
      };
    }
    return {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      pricePeriod: plan.pricePeriod as 'month' | 'year',
    };
  }

  async upgradeSubscription(
    userId: string,
    planId: UserPlan,
    pricePeriod: 'month' | 'year',
  ): Promise<{ id: string; name: string; price: number; pricePeriod: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException();
    const pricePeriodEnum =
      pricePeriod === 'year' ? PricePeriod.YEAR : PricePeriod.MONTH;
    const plan = await this.planRepository.findOne({
      where: { id: planId, pricePeriod: pricePeriodEnum },
    });
    if (!plan && planId !== UserPlan.FREE) {
      throw new HttpException(
        {
          error: {
            code: 'SUBSCRIPTION_UPGRADE_FAILED',
            message: 'Failed to upgrade subscription',
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    user.plan = planId;
    await this.userRepository.save(user);
    if (plan) {
      return {
        id: plan.id,
        name: plan.name,
        price: Number(plan.price),
        pricePeriod: plan.pricePeriod,
      };
    }
    return {
      id: planId,
      name: planId,
      price: 0,
      pricePeriod,
    };
  }

  async cancelSubscription(userId: string): Promise<{ success: true }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException();
    user.plan = UserPlan.FREE;
    await this.userRepository.save(user);
    return { success: true };
  }

  async getUsage(userId: string): Promise<{
    servers: { used: number; limit: number; isOverLimit: boolean };
    members: { used: number; limit: number; isOverLimit: boolean };
    messages: { used: number; limit: number; isOverLimit: boolean };
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException();
    const usage = await this.usageLimitsRepository.findOne({
      where: { userId },
    });
    const limits = await this.planLimitsRepository.findOne({
      where: { planId: user.plan },
    });
    const used = {
      servers: usage?.serversUsed ?? 0,
      members: usage?.membersUsed ?? 0,
      messages: usage?.messagesUsed ?? 0,
    };
    const limit = {
      servers: limits?.serversLimit ?? 0,
      members: limits?.membersLimit ?? 0,
      messages: limits?.messagesLimit ?? 0,
    };
    return {
      servers: {
        used: used.servers,
        limit: limit.servers,
        isOverLimit: limit.servers > 0 && used.servers >= limit.servers,
      },
      members: {
        used: used.members,
        limit: limit.members,
        isOverLimit: limit.members > 0 && used.members >= limit.members,
      },
      messages: {
        used: used.messages,
        limit: limit.messages,
        isOverLimit: limit.messages > 0 && used.messages >= limit.messages,
      },
    };
  }

  async getInvoices(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Array<{
      id: string;
      amount: number;
      currency: string;
      date: string;
      status: string;
      downloadUrl: string | null;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit));
    const take = Math.min(50, Math.max(1, limit));
    const [invoices, total] = await this.invoiceRepository.findAndCount({
      where: { userId },
      order: { date: 'DESC' },
      skip,
      take,
    });
    const data = invoices.map((i) => ({
      id: i.id,
      amount: Number(i.amount),
      currency: i.currency,
      date: i.date.toISOString(),
      status: i.status,
      downloadUrl: i.downloadUrl,
    }));
    const totalPages = Math.ceil(total / take) || 1;
    return {
      data,
      meta: { total, page: Math.max(1, page), limit: take, totalPages },
    };
  }

  async getInvoiceDownload(
    userId: string,
    invoiceId: string,
  ): Promise<{ content: Buffer; filename: string } | null> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, userId },
    });
    if (!invoice) return null;
    return {
      content: Buffer.from('PDF placeholder'),
      filename: `invoice-${invoiceId}.pdf`,
    };
  }
}
