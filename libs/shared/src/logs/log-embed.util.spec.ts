import { buildLogEmbedData } from './log-embed.util';

describe('log-embed.util', () => {
  it('builds member_join embed with all fields', () => {
    const data = buildLogEmbedData('member_join', {
      userTag: 'User#1234',
      userId: '123456789',
      timestamp: '2025-01-30T12:00:00.000Z',
    });
    expect(data.title).toBe('Участник присоединился');
    expect(data.fields).toHaveLength(3);
    expect(data.fields.find((f) => f.name === 'Участник')?.value).toBe('User#1234');
    expect(data.fields.find((f) => f.name === 'ID')?.value).toBe('123456789');
    expect(data.fields.find((f) => f.name === 'Время')?.value).toBe('2025-01-30T12:00:00.000Z');
  });

  it('builds member_leave embed with NA when user missing', () => {
    const data = buildLogEmbedData('member_leave', {});
    expect(data.title).toBe('Участник вышел');
    expect(data.fields.find((f) => f.name === 'Участник')?.value).toBe('—');
    expect(data.fields.find((f) => f.name === 'ID')?.value).toBe('—');
  });

  it('builds message_delete embed with NA when message content is empty', () => {
    const data = buildLogEmbedData('message_delete', {
      channelName: '#general',
      userTag: 'Author',
      messageContent: '',
      timestamp: '2025-01-30T12:00:00.000Z',
    });
    expect(data.title).toBe('Сообщение удалено');
    expect(data.fields.find((f) => f.name === 'Содержимое')?.value).toBe('—');
  });

  it('builds message_delete embed with long content truncated', () => {
    const longContent = 'a'.repeat(1100);
    const data = buildLogEmbedData('message_delete', {
      messageContent: longContent,
    });
    const contentField = data.fields.find((f) => f.name === 'Содержимое');
    expect(contentField?.value.length).toBeLessThanOrEqual(1024);
    expect(contentField?.value.endsWith('...')).toBe(true);
  });

  it('builds message_edit embed with old and new content', () => {
    const data = buildLogEmbedData('message_edit', {
      oldContent: 'old',
      newContent: 'new',
      userTag: 'User',
    });
    expect(data.title).toBe('Сообщение изменено');
    expect(data.fields.find((f) => f.name === 'Было')?.value).toBe('old');
    expect(data.fields.find((f) => f.name === 'Стало')?.value).toBe('new');
  });

  it('builds role_update embed with roles', () => {
    const data = buildLogEmbedData('role_update', {
      userTag: 'User',
      rolesAdded: ['Admin', 'Mod'],
      rolesRemoved: ['Member'],
    });
    expect(data.title).toBe('Обновление ролей');
    expect(data.fields.find((f) => f.name === 'Добавлены')?.value).toBe('Admin, Mod');
    expect(data.fields.find((f) => f.name === 'Сняты')?.value).toBe('Member');
  });

  it('builds voice_change embed', () => {
    const data = buildLogEmbedData('voice_change', {
      userTag: 'User',
      voiceChannelName: 'General',
    });
    expect(data.title).toBe('Голосовой канал');
    expect(data.fields.find((f) => f.name === 'Канал')?.value).toBe('General');
  });

  it('handles unknown event type with default title', () => {
    const data = buildLogEmbedData('unknown_event', { userTag: 'User' });
    expect(data.title).toBe('Событие: unknown_event');
    expect(data.fields.length).toBeGreaterThanOrEqual(2);
  });

  it('does not throw on empty payload', () => {
    expect(() => buildLogEmbedData('member_join', {})).not.toThrow();
    expect(() => buildLogEmbedData('message_delete', {})).not.toThrow();
  });
});
