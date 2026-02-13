import { Injectable } from '@nestjs/common';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { SharedConfigService } from '../config/shared-config.service';
import type {
  ActivityChartPointDto,
  AnalyticsOverviewDto,
  TopMemberDto,
} from './analytics.types';

@Injectable()
export class SharedAnalyticsService {
  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  private getDatabase(): string {
    return this.sharedConfig.clickhouse.database || 'default';
  }

  async getTotalVoiceMinutesByGuildId(guildId: string): Promise<number> {
    const db = this.getDatabase();
    const result = await this.clickhouse.query({
      query: `
        SELECT sumMerge(voice_minutes) AS total
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID}
        GROUP BY guild_id
      `,
      query_params: { guildId },
    });
    return this.parseSingleNumber(result, 0);
  }

  /**
   * Всего сообщений по гильдии за всё время (из mv_daily_activity).
   * При ошибке запроса к ClickHouse исключение пробрасывается.
   */
  async getTotalMessagesByGuildId(guildId: string): Promise<number> {
    const db = this.getDatabase();
    const result = await this.clickhouse.query({
      query: `
        SELECT sum(messages) AS total
        FROM (
          SELECT countIfMerge(messages_count) AS messages
          FROM ${db}.mv_daily_activity
          WHERE guild_id = {guildId:UUID}
          GROUP BY guild_id, event_date
        )
      `,
      query_params: { guildId },
    });
    return this.parseSingleNumber(result, 0);
  }

  /**
   * Глобальная сумма сообщений по всем гильдиям (из mv_daily_activity).
   * При ошибке запроса к ClickHouse исключение пробрасывается.
   */
  async getGlobalTotalMessages(): Promise<number> {
    const db = this.getDatabase();
    const result = await this.clickhouse.query({
      query: `
        SELECT sum(messages) AS total
        FROM (
          SELECT countIfMerge(messages_count) AS messages
          FROM ${db}.mv_daily_activity
          GROUP BY guild_id, event_date
        )
      `,
      query_params: {},
    });
    return this.parseSingleNumber(result, 0);
  }

  /**
   * Маппинг guild_id → всего сообщений за всё время для списка гильдий.
   * Пустой guildIds → пустая Map. При ошибке запроса исключение пробрасывается.
   */
  async getTotalMessagesByGuildIds(guildIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (guildIds.length === 0) return map;
    const db = this.getDatabase();
    const result = await this.clickhouse.query({
      query: `
        SELECT guild_id, sum(messages) AS total
        FROM (
          SELECT guild_id, event_date, countIfMerge(messages_count) AS messages
          FROM ${db}.mv_daily_activity
          WHERE guild_id IN {guildIds:Array(UUID)}
          GROUP BY guild_id, event_date
        )
        GROUP BY guild_id
      `,
      query_params: { guildIds },
    });
    const rows = (await result.json()) as { guild_id: string; total: string | number }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    for (const row of data) {
      if (row?.guild_id != null) {
        map.set(row.guild_id, Number(row.total ?? 0));
      }
    }
    return map;
  }

  async getOverviewByGuildId(
    guildId: string,
    timezone?: string,
  ): Promise<AnalyticsOverviewDto> {
    const db = this.getDatabase();

    const todayQuery =
      timezone != null && timezone.trim() !== ''
        ? `SELECT toDate(toTimeZone(now(), {tz:String})) AS today`
        : `SELECT toDate(now()) AS today`;
    const todayParams =
      timezone != null && timezone.trim() !== ''
        ? { tz: timezone }
        : {};

    const nowResult = await this.clickhouse.query({
      query: todayQuery,
      query_params: todayParams,
    });
    const nowJson = (await nowResult.json()) as
      | { today: string }[]
      | { data?: { today: string }[] };
    const nowRows = Array.isArray(nowJson)
      ? nowJson
      : (nowJson as { data?: { today: string }[] }).data ?? [];
    const today = (nowRows[0] as { today: string } | undefined)?.today ?? '';

    const totalMessagesResult = await this.clickhouse.query({
      query: `
        SELECT event_date, countIfMerge(messages_count) AS messages
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID}
          AND event_date >= toDate({today:Date}) - 30
          AND event_date <= {today:Date}
        GROUP BY guild_id, event_date
      `,
      query_params: { guildId, today },
    });
    const totalMessagesRows = (await totalMessagesResult.json()) as {
      messages: string | number;
    }[];
    const totalMessagesArr = Array.isArray(totalMessagesRows)
      ? totalMessagesRows
      : (totalMessagesRows as unknown as { data?: { messages: string | number }[] })
          .data ?? [];
    const totalMessages = totalMessagesArr.reduce(
      (acc, row) => acc + Number(row.messages ?? 0),
      0,
    );

    const active24hResult = await this.clickhouse.query({
      query: `
        SELECT uniqCombinedMerge(unique_users_count) AS cnt
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID} AND event_date = {today:Date}
        GROUP BY guild_id
      `,
      query_params: { guildId, today },
    });
    const activeMembers24h = await this.parseSingleNumber(active24hResult, 0);

    const active7dResult = await this.clickhouse.query({
      query: `
        SELECT uniqCombinedMerge(unique_users_count) AS cnt
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID}
          AND event_date >= toDate({today:Date}) - 7
          AND event_date <= {today:Date}
        GROUP BY guild_id
      `,
      query_params: { guildId, today },
    });
    const activeMembers7d = await this.parseSingleNumber(active7dResult, 0);

    return {
      totalMessages: Number(totalMessages),
      activeMembers24h: Number(activeMembers24h),
      activeMembers7d: Number(activeMembers7d),
    };
  }

  /**
   * Временной ряд по дням: сообщения, уникальные активные участники, минуты в голосе.
   * Запрос к raw_events, чтобы учитывать всю историю (в т.ч. данные до создания MV).
   * Отсутствующие дни в периоде заполняются нулями (по спецификации API).
   */
  async getActivityChartByGuildId(
    guildId: string,
    from: string,
    to: string,
    _timezone?: string,
  ): Promise<ActivityChartPointDto[]> {
    const db = this.getDatabase();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);

    const result = await this.clickhouse.query({
      query: `
        SELECT
          event_date AS date,
          countIf(event_type = 'MESSAGE_CREATE') AS messages,
          uniqCombinedIf(if(empty(discord_user_id), toString(user_id), discord_user_id), (discord_user_id != '' OR user_id IS NOT NULL)) AS members,
          sumIf(toUInt64(JSONExtractInt(payload, 'voiceMinutes')), event_type = 'VOICE_STATE_UPDATE') AS voiceMinutes
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
        GROUP BY guild_id, event_date
        ORDER BY event_date ASC
      `,
      query_params: { guildId, from: fromDate, to: toDate },
    });

    const rows = (await result.json()) as {
      date: string;
      messages: string | number;
      members: string | number;
      voiceMinutes: string | number;
    }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    const byDate = new Map<string, ActivityChartPointDto>();
    for (const row of data) {
      const d = String(row.date).slice(0, 10);
      byDate.set(d, {
        date: d,
        messages: Number(row.messages ?? 0),
        members: Number(row.members ?? 0),
        voiceMinutes: Number(row.voiceMinutes ?? 0),
      });
    }
    const out: ActivityChartPointDto[] = [];
    const fromMs = new Date(fromDate).getTime();
    const toMs = new Date(toDate).getTime();
    const oneDay = 86400000;
    for (let t = fromMs; t <= toMs; t += oneDay) {
      const d = new Date(t).toISOString().slice(0, 10);
      out.push(
        byDate.get(d) ?? {
          date: d,
          messages: 0,
          members: 0,
          voiceMinutes: 0,
        },
      );
    }
    return out;
  }

  /**
   * Топ участников по сообщениям/голосу. Группировка по эффективному идентификатору пользователя
   * (discord_user_id или anonymized_hash/user_id), чтобы корректно учитывать данные из history-sync и real-time.
   * При anonymizeUserData === false из payload извлекается userTag для отображения имени.
   */
  async getTopMembersByGuildId(
    guildId: string,
    sortBy: 'messages' | 'voice',
    limit: number,
    options?: { anonymizeUserData?: boolean },
  ): Promise<TopMemberDto[]> {
    const db = this.getDatabase();
    const anonymizeUserData = options?.anonymizeUserData ?? true;
    const tableRawEvents = `${db}.raw_events`;

    const orderBy =
      sortBy === 'voice'
        ? 'voice_minutes DESC, messages DESC'
        : 'messages DESC, voice_minutes DESC';

    const result = await this.clickhouse.query({
      query: `
        SELECT
          if(empty(discord_user_id), if(notEmpty(anonymized_hash), anonymized_hash, toString(user_id)), discord_user_id) AS id,
          argMax(JSONExtractString(payload, 'userTag'), event_time) AS username_from_payload,
          argMax(JSONExtractString(payload, 'avatar'), event_time) AS avatar_hash,
          countIf(event_type = 'MESSAGE_CREATE') AS messages,
          sumIf(toUInt64(JSONExtractInt(payload, 'voiceMinutes')), event_type = 'VOICE_STATE_UPDATE') AS voice_minutes
        FROM ${tableRawEvents}
        WHERE guild_id = {guildId:UUID}
          AND is_bot_generated = 0
          AND (discord_user_id != '' OR user_id IS NOT NULL OR notEmpty(anonymized_hash))
        GROUP BY guild_id, if(empty(discord_user_id), if(notEmpty(anonymized_hash), anonymized_hash, toString(user_id)), discord_user_id)
        ORDER BY ${orderBy}
        LIMIT {limit:UInt32}
      `,
      query_params: { guildId, limit },
    });

    const rows = (await result.json()) as {
      id: string;
      username_from_payload: string;
      avatar_hash: string;
      messages: string | number;
      voice_minutes: string | number;
    }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      id: row.id ?? '',
      username:
        anonymizeUserData || !row.username_from_payload
          ? 'Anonymous'
          : row.username_from_payload,
      discriminator: '',
      avatar:
        !anonymizeUserData && row.avatar_hash && row.id
          ? `https://cdn.discordapp.com/avatars/${row.id}/${row.avatar_hash}.png?size=80`
          : '',
      messages: Number(row.messages ?? 0),
      voiceMinutes: Number(row.voice_minutes ?? 0),
    }));
  }

  /**
   * Тепловая карта активности по дням недели (0=воскресенье, 6=суббота) и часам (0–23).
   * Данные из mv_heatmap (MESSAGE_CREATE). Возвращает все 7×24 ячейки; отсутствующие — 0.
   */
  async getHeatmapByGuildId(
    guildId: string,
  ): Promise<Array<{ dayOfWeek: number; hour: number; value: number }>> {
    const db = this.getDatabase();
    const result = await this.clickhouse.query({
      query: `
        SELECT
          toUInt8(day_of_week % 7) AS day_of_week,
          toUInt8(hour) AS hour,
          sum(events_count) AS value
        FROM ${db}.mv_heatmap
        WHERE guild_id = {guildId:UUID}
        GROUP BY guild_id, day_of_week, hour
      `,
      query_params: { guildId },
    });
    const rows = (await result.json()) as {
      day_of_week: string | number;
      hour: string | number;
      value: string | number;
    }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    const map = new Map<string, number>();
    for (const row of data) {
      const d = Number(row.day_of_week ?? 0);
      const h = Number(row.hour ?? 0);
      if (d >= 0 && d <= 6 && h >= 0 && h <= 23) {
        map.set(`${d}-${h}`, Number(row.value ?? 0));
      }
    }
    const out: Array<{ dayOfWeek: number; hour: number; value: number }> = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hour = 0; hour < 24; hour++) {
        out.push({
          dayOfWeek,
          hour,
          value: map.get(`${dayOfWeek}-${hour}`) ?? 0,
        });
      }
    }
    return out;
  }

  /**
   * Распределение событий по ролям за период (Activity by Role).
   * Запрос к raw_events, чтобы учитывать всю историю (в т.ч. данные до создания MV).
   */
  async getRoleDistributionByGuildId(
    guildId: string,
    from: string,
    to: string,
  ): Promise<Array<{ id: string; count: number }>> {
    const db = this.getDatabase();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);

    const result = await this.clickhouse.query({
      query: `
        SELECT
          role_id AS id,
          count() AS count
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
          AND role_id != ''
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
        GROUP BY guild_id, role_id
        ORDER BY count DESC
      `,
      query_params: { guildId, from: fromDate, to: toDate },
    });

    const rows = (await result.json()) as { id: string; count: string | number }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      id: row.id ?? '',
      count: Number(row.count ?? 0),
    }));
  }

  /**
   * Топ текстовых каналов по числу сообщений за период.
   * Запрос к raw_events, чтобы учитывать всю историю (в т.ч. данные, попавшие в БД до создания MV).
   */
  async getTopChannelsByMessages(
    guildId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Array<{ id: string; value: number }>> {
    const db = this.getDatabase();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);

    const result = await this.clickhouse.query({
      query: `
        SELECT
          channel_id AS id,
          count() AS value
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
          AND event_type = 'MESSAGE_CREATE'
          AND channel_id != ''
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
        GROUP BY guild_id, channel_id
        ORDER BY value DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { guildId, from: fromDate, to: toDate, limit },
    });

    const rows = (await result.json()) as { id: string; value: string | number }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      id: row.id ?? '',
      value: Number(row.value ?? 0),
    }));
  }

  /**
   * Топ голосовых каналов по минутам в голосе за период.
   * Запрос к raw_events, чтобы учитывать всю историю (в т.ч. данные до создания MV).
   */
  async getTopChannelsByVoice(
    guildId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Array<{ id: string; value: number }>> {
    const db = this.getDatabase();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);

    const result = await this.clickhouse.query({
      query: `
        SELECT
          channel_id AS id,
          sum(toUInt64(JSONExtractInt(payload, 'voiceMinutes'))) AS value
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
          AND event_type = 'VOICE_STATE_UPDATE'
          AND channel_id != ''
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
        GROUP BY guild_id, channel_id
        ORDER BY value DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { guildId, from: fromDate, to: toDate, limit },
    });

    const rows = (await result.json()) as { id: string; value: string | number }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      id: row.id ?? '',
      value: Number(row.value ?? 0),
    }));
  }

  async getTopCommandsByGuildId(
    guildId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      name: string;
      usageCount: number;
      lastUsedAt: string;
      category: string;
    }>
  > {
    const db = this.getDatabase();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);

    const result = await this.clickhouse.query({
      query: `
        SELECT
          command_name AS name,
          sum(execution_count) AS usageCount,
          max(event_date) AS lastUsedAt
        FROM ${db}.mv_command_stats
        WHERE guild_id = {guildId:UUID}
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
        GROUP BY guild_id, command_name
        ORDER BY usageCount DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { guildId, from: fromDate, to: toDate, limit },
    });

    const rows = (await result.json()) as {
      name: string;
      usageCount: string | number;
      lastUsedAt: string;
    }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      id: row.name ?? '',
      name: row.name ?? '',
      usageCount: Number(row.usageCount ?? 0),
      lastUsedAt: row.lastUsedAt ? `${row.lastUsedAt}T00:00:00.000Z` : '',
      category: '',
    }));
  }

  async getUserStatsForExport(
    userId: string,
    discordId: string | null,
  ): Promise<{ totalMessages: number; totalVoiceMinutes: number }> {
    const db = this.getDatabase();
    const hasUserId = userId != null && userId.trim() !== '';
    const hasDiscordId =
      discordId != null && typeof discordId === 'string' && discordId.trim() !== '';

    if (!hasUserId && !hasDiscordId) {
      return { totalMessages: 0, totalVoiceMinutes: 0 };
    }

    let whereClause: string;
    const queryParams: Record<string, unknown> = {};

    if (hasUserId && hasDiscordId) {
      whereClause =
        '(discord_user_id = {discordId:String} OR user_id = {userId:UUID}) AND (discord_user_id != \'\' OR user_id IS NOT NULL)';
      queryParams.userId = userId;
      queryParams.discordId = discordId;
    } else if (hasUserId) {
      whereClause = 'user_id = {userId:UUID}';
      queryParams.userId = userId;
    } else {
      whereClause = 'discord_user_id = {discordId:String}';
      queryParams.discordId = discordId!;
    }

    const result = await this.clickhouse.query({
      query: `
        SELECT
          countIf(event_type = 'MESSAGE_CREATE') AS totalMessages,
          sum(if(event_type = 'VOICE_STATE_UPDATE', toUInt64(JSONExtractInt(payload, 'voiceMinutes')), 0)) AS totalVoiceMinutes
        FROM ${db}.raw_events
        WHERE ${whereClause}
      `,
      query_params: queryParams,
    });

    const rows = (await result.json()) as {
      totalMessages: string | number;
      totalVoiceMinutes: string | number;
    }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    const row = data[0] as { totalMessages?: string | number; totalVoiceMinutes?: string | number } | undefined;
    return {
      totalMessages: Number(row?.totalMessages ?? 0),
      totalVoiceMinutes: Number(row?.totalVoiceMinutes ?? 0),
    };
  }

  /**
   * Временной ряд по типам событий для произвольного периода.
   * Группировка по day/week/month и event_type.
   */
  async getEventsTimeSeriesByGuildId(
    guildId: string,
    from: string,
    to: string,
    groupBy: 'day' | 'week' | 'month',
    eventTypes?: string[],
    _timezone?: string,
  ): Promise<Array<{ date: string; eventType: string; count: number }>> {
    const db = this.getDatabase();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);
    const groupExpr =
      groupBy === 'day'
        ? 'toDate(event_time)'
        : groupBy === 'week'
          ? 'toStartOfWeek(toDate(event_time))'
          : 'toStartOfMonth(toDate(event_time))';
    const eventFilter =
      eventTypes != null && eventTypes.length > 0
        ? `AND event_type IN {eventTypes:Array(String)}`
        : '';
    const queryParams: Record<string, unknown> = {
      guildId,
      from: fromDate,
      to: toDate,
    };
    if (eventTypes != null && eventTypes.length > 0) {
      queryParams.eventTypes = eventTypes;
    }
    const result = await this.clickhouse.query({
      query: `
        SELECT
          ${groupExpr} AS date,
          event_type AS eventType,
          count() AS count
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
          ${eventFilter}
        GROUP BY date, event_type
        ORDER BY date ASC, eventType ASC
      `,
      query_params: queryParams,
    });
    const rows = (await result.json()) as { date: string; eventType: string; count: string | number }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      date: String(row.date).slice(0, 10),
      eventType: String(row.eventType),
      count: Number(row.count ?? 0),
    }));
  }

  /**
   * Поиск событий по гильдии с фильтрами и пагинацией по курсору.
   */
  async getEventsByGuildId(
    guildId: string,
    from: string,
    to: string,
    options: {
      eventTypes?: string[];
      channelId?: string;
      limit: number;
      cursor?: { eventId: string; eventTime: string };
    },
  ): Promise<{
    data: Array<{
      eventId: string;
      eventTime: string;
      eventType: string;
      channelId: string | null;
      payloadSummary?: Record<string, unknown>;
    }>;
    nextCursor?: { eventId: string; eventTime: string };
  }> {
    const db = this.getDatabase();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);
    const limit = Math.min(Math.max(1, options.limit), 100);
    const eventFilter =
      options.eventTypes != null && options.eventTypes.length > 0
        ? `AND event_type IN {eventTypes:Array(String)}`
        : '';
    const channelFilter =
      options.channelId != null && options.channelId.trim() !== ''
        ? `AND channel_id = {channelId:String}`
        : '';
    const cursorCondition =
      options.cursor != null
        ? `AND (event_time, event_id) < (toDateTime({cursorTime:String}), {cursorId:UUID})`
        : '';
    const queryParams: Record<string, unknown> = {
      guildId,
      from: fromDate,
      to: toDate,
      limit: limit + 1,
    };
    if (options.eventTypes != null && options.eventTypes.length > 0) {
      queryParams.eventTypes = options.eventTypes;
    }
    if (options.channelId != null && options.channelId.trim() !== '') {
      queryParams.channelId = options.channelId;
    }
    if (options.cursor != null) {
      queryParams.cursorTime = options.cursor.eventTime.replace('T', ' ').replace('Z', '').slice(0, 19);
      queryParams.cursorId = options.cursor.eventId;
    }
    const result = await this.clickhouse.query({
      query: `
        SELECT event_id, event_time, event_type, channel_id, payload
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
          ${eventFilter}
          ${channelFilter}
          ${cursorCondition}
        ORDER BY event_time DESC, event_id DESC
        LIMIT {limit:UInt32}
      `,
      query_params: queryParams,
    });
    const rows = (await result.json()) as Array<{
      event_id: string;
      event_time: string;
      event_type: string;
      channel_id: string;
      payload: string;
    }>;
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    const hasMore = data.length > limit;
    const slice = hasMore ? data.slice(0, limit) : data;
    const nextCursor =
      hasMore && slice.length > 0
        ? {
            eventId: slice[slice.length - 1].event_id,
            eventTime: String(slice[slice.length - 1].event_time).replace(' ', 'T') + 'Z',
          }
        : undefined;
    return {
      data: slice.map((row) => ({
        eventId: row.event_id,
        eventTime: String(row.event_time).replace(' ', 'T') + 'Z',
        eventType: row.event_type,
        channelId: row.channel_id != null && row.channel_id !== '' ? row.channel_id : null,
        payloadSummary: this.summarizePayload(row.payload, row.event_type),
      })),
      nextCursor,
    };
  }

  private summarizePayload(
    payloadJson: string,
    _eventType: string,
  ): Record<string, unknown> | undefined {
    try {
      const p = JSON.parse(payloadJson) as Record<string, unknown>;
      if (p == null || typeof p !== 'object') return undefined;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(p).slice(0, 12)) {
        const v = p[k];
        if (v !== undefined && v !== null && typeof v !== 'object') out[k] = v;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    } catch {
      return undefined;
    }
  }

  private async parseSingleNumber(
    result: Awaited<ReturnType<ClickHouseService['query']>>,
    defaultValue: number,
  ): Promise<number> {
    const j = (await result.json()) as
      | { total?: number; cnt?: number }[]
      | { data?: { total?: number; cnt?: number }[] };
    const arr = Array.isArray(j)
      ? j
      : (j as { data?: { total?: number; cnt?: number }[] }).data ?? [];
    const row = arr[0] as { total?: number; cnt?: number } | undefined;
    const val = row?.total ?? row?.cnt ?? defaultValue;
    return Number(val);
  }
}
