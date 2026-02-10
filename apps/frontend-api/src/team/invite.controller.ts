import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { InviteTokenParamDto } from './dto/invite-token-param.dto';

@ApiTags('Invites')
@Controller('invites')
export class InviteController {
  constructor(private readonly teamService: TeamService) {}

  @Get(':token')
  @ApiOperation({
    summary: 'Get invite preview',
    description:
      'Returns invite details (company name, inviter name, role) for displaying accept UI. Public, no auth required.',
  })
  async getInvitePreview(
    @Param() params: InviteTokenParamDto,
  ): Promise<{
    data: {
      companyName: string;
      inviterName: string;
      role: string;
    };
  }> {
    const data = await this.teamService.getInvitePreview(params.token);
    return { data };
  }
}
