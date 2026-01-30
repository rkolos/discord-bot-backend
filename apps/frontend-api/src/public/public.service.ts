import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild, User, SubscriptionPlan } from '@app/shared';

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
}

export interface PricingItem {
  id: string;
  name: string;
  price: number;
  pricePeriod: 'month' | 'year';
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

export interface SocialProofItem {
  id: string;
  name: string;
  logo: string;
  url: string;
}

export interface DocArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  content: string;
  excerpt: string;
  updatedAt: string;
}

export interface DocCategory {
  id: string;
  name: string;
  slug: string;
  articles: DocArticle[];
}

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  async getFeatures(): Promise<FeatureItem[]> {
    return [
      {
        id: 'counters',
        title: 'Counters',
        description: 'Real-time member and message counters for your server',
        icon: 'chart',
        category: 'analytics',
      },
      {
        id: 'analytics',
        title: 'Analytics',
        description: 'Detailed server activity and growth analytics',
        icon: 'graph',
        category: 'analytics',
      },
      {
        id: 'widgets',
        title: 'Widgets',
        description: 'Embeddable widgets for your website',
        icon: 'embed',
        category: 'integration',
      },
    ];
  }

  async getPricing(): Promise<PricingItem[]> {
    const plans = await this.subscriptionPlanRepository.find({
      order: { id: 'ASC' },
    });
    if (plans.length === 0) {
      return [
        {
          id: 'free',
          name: 'Free',
          price: 0,
          pricePeriod: 'month',
          description: 'Get started with basic features',
          features: ['1 server', 'Basic counters', 'Community support'],
          highlighted: false,
          cta: 'Get Started',
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 9.99,
          pricePeriod: 'month',
          description: 'For growing communities',
          features: ['5 servers', 'Full analytics', 'Priority support'],
          highlighted: true,
          cta: 'Upgrade',
        },
      ];
    }
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      pricePeriod: p.pricePeriod as 'month' | 'year',
      description: p.name,
      features: [],
      highlighted: p.id === 'pro',
      cta: p.id === 'free' ? 'Get Started' : 'Upgrade',
    }));
  }

  async getSocialProof(): Promise<SocialProofItem[]> {
    return [];
  }

  private readonly docCategories: DocCategory[] = [
    {
      id: 'getting-started',
      name: 'Getting Started',
      slug: 'getting-started',
      articles: [
        {
          id: 'quickstart',
          title: 'Quick Start',
          slug: 'quickstart',
          category: 'getting-started',
          content: 'Add the bot to your Discord server and configure counters.',
          excerpt: 'Add the bot and configure counters.',
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  ];

  async getDocCategories(): Promise<DocCategory[]> {
    return this.docCategories;
  }

  async getDocArticleBySlug(slug: string): Promise<DocArticle> {
    for (const cat of this.docCategories) {
      const article = cat.articles.find((a) => a.slug === slug);
      if (article) return article;
    }
    throw new NotFoundException({
      code: 'DOC_ARTICLE_NOT_FOUND',
      message: 'Documentation article not found',
    });
  }

  async getPublicStats(): Promise<{
    totalServers: number;
    totalUsers: number;
    totalMessages: number;
  }> {
    const [guildCount, userCount] = await Promise.all([
      this.guildRepository.count(),
      this.userRepository.count(),
    ]);
    const guilds = await this.guildRepository
      .createQueryBuilder('g')
      .select('COALESCE(SUM(g.message_count), 0)', 'sum')
      .getRawOne<{ sum: string }>();
    const totalMessages = Number(guilds?.sum ?? 0);
    return {
      totalServers: guildCount,
      totalUsers: userCount,
      totalMessages,
    };
  }
}
