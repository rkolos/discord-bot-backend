export interface AnalyticsOverviewDto {
  totalMessages: number;
  activeMembers24h: number;
  activeMembers7d: number;
}

export interface ActivityChartPointDto {
  date: string;
  messages: number;
  members: number;
  voiceMinutes: number;
}

export interface TopMemberDto {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  messages: number;
  voiceMinutes: number;
}
