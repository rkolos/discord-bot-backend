/**
 * CLI-скрипт регистрации slash-команд в Discord.
 * Запуск: npx ts-node scripts/register-commands.ts <TOKEN> [--guild-id=<discordGuildId>]
 * Без --guild-id регистрирует команды глобально; с --guild-id — для гильдии.
 */
const DISCORD_API_BASE = 'https://discord.com/api/v10';

const COMMANDS = [
  { name: 'ping', description: 'Показать задержку API и WebSocket', type: 1 },
  { name: 'stats', description: 'Ключевые метрики сервера за 30 дней', type: 1 },
] as const;

async function getApplicationId(token: string): Promise<string> {
  const res = await fetch(`${DISCORD_API_BASE}/applications/@me`, {
    method: 'GET',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get application id: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function putCommands(
  token: string,
  applicationId: string,
  discordGuildId: string | null,
): Promise<void> {
  const path = discordGuildId
    ? `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${discordGuildId}/commands`
    : `${DISCORD_API_BASE}/applications/${applicationId}/commands`;
  const res = await fetch(path, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(COMMANDS),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to put commands: ${res.status} ${text}`);
  }
}

function parseArgs(): { token: string; guildId: string | null } {
  const args = process.argv.slice(2);
  const token = args.find((a) => !a.startsWith('--'));
  const guildArg = args.find((a) => a.startsWith('--guild-id='));
  const guildId = guildArg ? guildArg.replace('--guild-id=', '').trim() || null : null;
  if (!token) {
    console.error('Usage: npx ts-node scripts/register-commands.ts <TOKEN> [--guild-id=<discordGuildId>]');
    process.exit(1);
  }
  return { token, guildId };
}

async function main(): Promise<void> {
  const { token, guildId } = parseArgs();
  const applicationId = await getApplicationId(token);
  await putCommands(token, applicationId, guildId);
  console.log(
    guildId
      ? `Registered ${COMMANDS.length} commands for guild ${guildId}`
      : `Registered ${COMMANDS.length} global commands`,
  );
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
