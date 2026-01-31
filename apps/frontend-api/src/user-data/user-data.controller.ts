import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@app/shared';
import { UserDataService } from './user-data.service';

@ApiTags('User Data')
@ApiBearerAuth()
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UserDataController {
  constructor(private readonly userDataService: UserDataService) {}

  @Delete('data')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete all my data',
    description:
      'Deletes all user data (GDPR). Requires Bearer JWT.',
  })
  async deleteAllData(@CurrentUser() user: User): Promise<void> {
    await this.userDataService.deleteAllUserData(user);
  }

  @Get('data/export')
  @ApiOperation({
    summary: 'Export my data',
    description:
      'Returns user data as JSON download (GDPR data export). Requires Bearer JWT.',
  })
  async exportData(
    @CurrentUser() user: User,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const data = await this.userDataService.exportUserData(user);
    const filename = `user-data-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.status(HttpStatus.OK).json({ data: { export: data } });
  }
}
