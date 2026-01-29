import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Body для PATCH /api/guilds/:guildId/token.
 * botToken опционален: при наличии — шифруется и сохраняется; при отсутствии или пустой строке — очистка токена.
 */
export class PatchGuildTokenDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'botToken must not be empty when provided' })
  botToken?: string;
}
