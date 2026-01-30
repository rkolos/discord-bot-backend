import { IsObject, IsString, IsOptional } from 'class-validator';

export class WidgetConfigDto {
  @IsOptional()
  type?: 'stats' | 'leaderboard' | 'activity';

  @IsOptional()
  theme?: 'light' | 'dark' | 'auto';

  @IsOptional()
  size?: 'small' | 'medium' | 'large';

  @IsOptional()
  showTitle?: boolean;

  @IsOptional()
  showLogo?: boolean;

  @IsOptional()
  customColors?: { primary?: string; background?: string; text?: string };
}

export class CreateWidgetDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  config?: WidgetConfigDto;
}
