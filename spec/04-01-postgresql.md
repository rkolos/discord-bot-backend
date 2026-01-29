# 4.1. PostgreSQL (Transactional Layer)

> **Важное примечание:** Перед началом реализации необходимо детально изучить всю документацию в папке `ABOUT/` и её подпапках (`API_SPEC_ADMIN`, `API_SPEC_FRONT`), а также ознакомиться с уже описанными пунктами в папке `spec/` для полного понимания контекста и текущих архитектурных решений.

Ниже описан **минимальный набор** таблиц и полей, необходимых для реализации API‑спецификаций и требований ТЗ. Если в процессе реализации потребуется добавить технические поля (например, `updated_at`, `deleted_at`, `source`), это допускается без изменения контрактов API.

## 4.1.1 Список таблиц и ключевые поля

### 1) users
Хранит пользователей платформы (Discord/Email).
- `id` UUID PK  
- `discord_id` TEXT UNIQUE NULL
- `username` TEXT NOT NULL
- `discriminator` TEXT NULL
- `avatar_url` TEXT NULL
- `email` TEXT UNIQUE NULL
- `plan` TEXT NOT NULL CHECK (plan IN ('free','pro','enterprise'))
- `status` TEXT NOT NULL CHECK (status IN ('active','banned'))
- `created_at` TIMESTAMPTZ NOT NULL
- `last_login_at` TIMESTAMPTZ NULL

### 2) refresh_tokens
Хранит refresh‑токены для пользовательской аутентификации.
- `id` UUID PK  
- `user_id` UUID FK -> users.id
- `token_hash` TEXT NOT NULL
- `expires_at` TIMESTAMPTZ NOT NULL
- `revoked_at` TIMESTAMPTZ NULL
- `created_at` TIMESTAMPTZ NOT NULL

### 3) admin_users
Административные аккаунты для Admin API.
- `id` UUID PK  
- `email` TEXT UNIQUE NOT NULL
- `name` TEXT NOT NULL
- `avatar_url` TEXT NULL
- `role` TEXT NOT NULL CHECK (role IN ('admin','super_admin'))
- `password_hash` TEXT NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL
- `last_login_at` TIMESTAMPTZ NULL

### 4) companies
Workspace/компания для групповой работы и биллинга.
- `id` UUID PK  
- `name` TEXT NOT NULL
- `owner_id` UUID FK -> users.id
- `created_at` TIMESTAMPTZ NOT NULL

### 5) company_members
Состав команды и роли.
- `id` UUID PK  
- `company_id` UUID FK -> companies.id
- `user_id` UUID FK -> users.id
- `role` TEXT NOT NULL CHECK (role IN ('Owner','Admin','Member'))
- `joined_at` TIMESTAMPTZ NOT NULL

### 6) company_invites
Инвайты в команду.
- `id` UUID PK  
- `company_id` UUID FK -> companies.id
- `email` TEXT NOT NULL
- `role` TEXT NOT NULL CHECK (role IN ('Owner','Admin','Member'))
- `invite_token` TEXT UNIQUE NOT NULL
- `invited_by` UUID FK -> users.id
- `expires_at` TIMESTAMPTZ NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL

### 7) guilds
Данные о Discord‑гильдиях.
- `id` UUID PK  
- `discord_guild_id` TEXT UNIQUE NOT NULL
- `name` TEXT NOT NULL
- `icon_url` TEXT NULL
- `banner` TEXT NULL
- `owner_id` UUID FK -> users.id
- `status` TEXT NOT NULL CHECK (status IN ('active','inactive','error'))
- `subscription_tier` TEXT NOT NULL CHECK (subscription_tier IN ('free','pro','enterprise'))
- `member_count` INTEGER NOT NULL DEFAULT 0
- `message_count` BIGINT NOT NULL DEFAULT 0
- `online_members` INTEGER NULL
- `member_growth` INTEGER NULL
- `last_activity` TIMESTAMPTZ NULL
- `shard_id` INTEGER NULL
- `is_bot_in_guild` BOOLEAN NOT NULL DEFAULT false
- `created_at` TIMESTAMPTZ NOT NULL
- `history_sync_status` TEXT NOT NULL DEFAULT 'PENDING' CHECK (history_sync_status IN ('PENDING','PROCESSING','COMPLETED','FAILED'))

### 8) guild_modules
Список включенных модулей по гильдии.
- `id` UUID PK  
- `guild_id` UUID FK -> guilds.id
- `module_key` TEXT NOT NULL
- `enabled` BOOLEAN NOT NULL DEFAULT true
- `has_error` BOOLEAN NOT NULL DEFAULT false

### 9) server_settings
Настройки гильдии (endpoint settings).
- `guild_id` UUID PK FK -> guilds.id
- `server_name` TEXT NOT NULL
- `server_description` TEXT NULL
- `language` TEXT NOT NULL
- `timezone` TEXT NOT NULL DEFAULT 'UTC' — часовой пояс гильдии (IANA, напр. Europe/Moscow); нужен для корректной агрегации по дням в ClickHouse и отрисовки графиков на фронте (при несовпадении с серверным графики «съезжают»).
- `bot_token_encrypted` TEXT NULL
- `bot_connected` BOOLEAN NOT NULL DEFAULT false
- `bot_user_id` TEXT NULL
- `last_connected` TIMESTAMPTZ NULL
- `last_sync_at` TIMESTAMPTZ NULL — время последней синхронизации участников/каналов/ролей; для контроля актуальности кэша и отображения в Admin API при необходимости.
- `data_retention_days` INTEGER NOT NULL DEFAULT 0
- `anonymize_user_data` BOOLEAN NOT NULL DEFAULT true
- `share_analytics` BOOLEAN NOT NULL DEFAULT true
- `allow_public_widgets` BOOLEAN NOT NULL DEFAULT true
- `updated_at` TIMESTAMPTZ NOT NULL

### 10) counters
Каунтеры (stat/goal/clock).
- `id` UUID PK  
- `guild_id` UUID FK -> guilds.id
- `channel_id` TEXT NOT NULL
- `channel_name` TEXT NOT NULL
- `type` TEXT NOT NULL CHECK (type IN ('stat','goal','clock'))
- `metric` TEXT NULL CHECK (metric IN ('members','messages','voice','online'))
- `template` TEXT NOT NULL
- `status` TEXT NOT NULL CHECK (status IN ('active','inactive','error'))
- `current_value` BIGINT NULL
- `target` BIGINT NULL
- `timezone` TEXT NULL
- `date_format` TEXT NULL
- `created_at` TIMESTAMPTZ NOT NULL
- `updated_at` TIMESTAMPTZ NOT NULL

### 11) widgets
Виджеты и их конфигурация.
- `id` UUID PK  
- `guild_id` UUID FK -> guilds.id
- `name` TEXT NOT NULL
- `config` JSONB NOT NULL
- `embed_url` TEXT NOT NULL
- `embed_code` TEXT NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL
- `updated_at` TIMESTAMPTZ NOT NULL

### 12) subscription_plans
Справочник тарифов.
- `id` TEXT PK CHECK (id IN ('free','pro','enterprise'))
- `name` TEXT NOT NULL
- `price` NUMERIC(10,2) NOT NULL
- `price_period` TEXT NOT NULL CHECK (price_period IN ('month','year'))

### 13) plan_limits
Справочник лимитов по плану (эталонные значения для сравнения с `usage_limits` без хардкода в коде).
- `plan_id` TEXT PK FK -> subscription_plans.id
- `servers_limit` INTEGER NOT NULL
- `members_limit` INTEGER NOT NULL
- `messages_limit` INTEGER NOT NULL

### 14) user_subscriptions
Текущая подписка пользователя.
- `id` UUID PK  
- `user_id` UUID FK -> users.id
- `plan_id` TEXT FK -> subscription_plans.id
- `status` TEXT NOT NULL CHECK (status IN ('active','canceled','expired'))
- `started_at` TIMESTAMPTZ NOT NULL
- `canceled_at` TIMESTAMPTZ NULL

### 15) invoices
Счета/инвойсы пользователя.
- `id` UUID PK  
- `user_id` UUID FK -> users.id
- `amount` NUMERIC(10,2) NOT NULL
- `currency` TEXT NOT NULL
- `date` TIMESTAMPTZ NOT NULL
- `status` TEXT NOT NULL CHECK (status IN ('paid','pending','failed'))
- `download_url` TEXT NULL

### 16) usage_limits
Лимиты и текущее потребление для биллинга.
- `user_id` UUID PK FK -> users.id
- `servers_limit` INTEGER NOT NULL DEFAULT 0
- `members_limit` INTEGER NOT NULL DEFAULT 0
- `messages_limit` INTEGER NOT NULL DEFAULT 0
- `servers_used` INTEGER NOT NULL DEFAULT 0
- `members_used` INTEGER NOT NULL DEFAULT 0
- `messages_used` INTEGER NOT NULL DEFAULT 0
- `updated_at` TIMESTAMPTZ NOT NULL

### 17) activity_log
Лог действий пользователя (используется в Admin API).
- `id` UUID PK  
- `user_id` UUID FK -> users.id
- `action` TEXT NOT NULL
- `details` TEXT NULL
- `created_at` TIMESTAMPTZ NOT NULL

## 4.1.2 Связи и индексы

- **Связи (FK)** обязаны покрывать:
  - `guilds.owner_id -> users.id`
  - `company_members.user_id -> users.id`, `company_members.company_id -> companies.id`
  - `counters.guild_id -> guilds.id`, `widgets.guild_id -> guilds.id`, `guild_modules.guild_id -> guilds.id`, `server_settings.guild_id -> guilds.id`
  - `refresh_tokens.user_id -> users.id`, `user_subscriptions.user_id -> users.id`, `user_subscriptions.plan_id -> subscription_plans.id`, `plan_limits.plan_id -> subscription_plans.id`, `invoices.user_id -> users.id`, `activity_log.user_id -> users.id`
- **Индексы** для ускорения выборок:
  - `guilds(owner_id)`, `guilds(discord_guild_id)`, `guilds(status)`
  - `counters(guild_id)`, `widgets(guild_id)`, `server_settings(guild_id)`
  - `company_members(company_id)`, `company_members(user_id)`
  - `refresh_tokens(user_id)`, `refresh_tokens(expires_at)`
  - `users(email)`, `users(discord_id)`

### 4.1.2.1 Поведение при удалении (ON DELETE)

- **ON DELETE CASCADE** для зависимостей от гильдии: при удалении записи в `guilds` связанные записи удаляются автоматически для:
  - `counters.guild_id` → `guilds.id`
  - `widgets.guild_id` → `guilds.id`
  - `guild_modules.guild_id` → `guilds.id`
  - `server_settings.guild_id` → `guilds.id`
- **activity_log** и **invoices** (связь с `users.id`): для сохранения истории аудита и финансовой отчётности используется **ON DELETE SET NULL** для поля `user_id`. При удалении пользователя запись в `activity_log` и `invoices` остаётся, `user_id` устанавливается в NULL. Удаление пользователя, имеющего активные счета (например, со статусом `pending`), может дополнительно ограничиваться на уровне приложения согласно политике хранения финансовой истории.

## 4.1.3 JSONB‑валидация

Обязательное требование:
- поле `widgets.config` должно валидироваться по схеме (тип, тема, размер, флаги, кастомные цвета);
- при необходимости допускается использование `CHECK` + `jsonb_schema` или валидации на уровне приложения, но результат должен быть одинаковым для всех API‑путей.

## 4.1.4 Раздельные адреса API (Frontend/Admin)

В документации и конфигурации проекта должно быть явно зафиксировано, что:
- **Frontend API** размещается на публичном адресе (пример: `https://api.server.ninja`).
- **Admin API** размещается на внутреннем адресе и доступен только через VPN (пример: `https://admin-api.internal.server.ninja`).
- Размещение по разным адресам является обязательным требованием для инфраструктуры и деплоя.
