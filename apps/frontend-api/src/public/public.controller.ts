import { Controller, Get, Param } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller()
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('features')
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
