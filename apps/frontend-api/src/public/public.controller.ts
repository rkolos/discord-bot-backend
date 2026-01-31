import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service';

@ApiTags('Public')
@Controller()
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('features')
  @ApiOperation({
    summary: 'List product features',
    description:
      'Returns the list of product features (counters, analytics, widgets, etc.) for landing or docs. No auth required.',
  })
  async getFeatures(): Promise<{
    data: Array<{
      id: string;
      title: string;
      description: string;
      icon: string;
      category: string;
    }>;
  }> {
    const data = await this.publicService.getFeatures();
    return { data };
  }

  @Get('pricing')
  @ApiOperation({
    summary: 'List pricing plans',
    description:
      'Returns pricing tiers (free, pro, etc.) with price, features, CTA. Use for pricing page. No auth required.',
  })
  async getPricing(): Promise<{
    data: Array<{
      id: string;
      name: string;
      price: number;
      pricePeriod: 'month' | 'year';
      description: string;
      features: string[];
      highlighted: boolean;
      cta: string;
    }>;
  }> {
    const data = await this.publicService.getPricing();
    return { data };
  }

  @Get('social-proof')
  @ApiOperation({
    summary: 'Social proof entries',
    description:
      'Returns testimonials or social proof items for landing. No auth required.',
  })
  async getSocialProof(): Promise<{
    data: Array<{
      id: string;
      name: string;
      logo: string;
      url: string;
    }>;
  }> {
    const data = await this.publicService.getSocialProof();
    return { data };
  }

  @Get('docs/categories')
  @ApiOperation({
    summary: 'Documentation categories',
    description:
      'Returns docs categories with articles (id, title, slug, excerpt). Use to build docs navigation. No auth required.',
  })
  async getDocCategories(): Promise<{
    data: Array<{
      id: string;
      name: string;
      slug: string;
      articles: Array<{
        id: string;
        title: string;
        slug: string;
        category: string;
        content: string;
        excerpt: string;
        updatedAt: string;
      }>;
    }>;
  }> {
    const data = await this.publicService.getDocCategories();
    return { data };
  }

  @Get('docs/:slug')
  @ApiOperation({
    summary: 'Get documentation article by slug',
    description:
      'Returns a single docs article by slug (title, content, excerpt, updatedAt). No auth required.',
  })
  async getDocArticle(
    @Param('slug') slug: string,
  ): Promise<{
    data: {
      id: string;
      title: string;
      slug: string;
      category: string;
      content: string;
      excerpt: string;
      updatedAt: string;
    };
  }> {
    const data = await this.publicService.getDocArticleBySlug(slug);
    return { data };
  }

  @Get('stats')
  async getStats(): Promise<{
    data: {
      totalServers: number;
      totalUsers: number;
      totalMessages: number;
    };
  }> {
    const data = await this.publicService.getPublicStats();
    return { data };
  }
}
