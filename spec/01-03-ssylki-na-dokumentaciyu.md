# 1.3. Ссылки на документацию

Данный документ содержит ссылки на всю доступную документацию проекта Server.Ninja, необходимую для разработки и понимания системы.

## Основная документация

### Техническое задание (ТЗ)
- **Файл:** [`ABOUT/about.md`](../../ABOUT/about.md)
- **Описание:** Полная структура технического задания на разработку Backend для Server.Ninja
- **Содержание:**
  - Введение и цели проекта
  - Архитектурное решение
  - Стек технологий
  - Проектирование баз данных
  - Описание API и контрактов
  - Реализация бизнес-логики
  - Интеграции
  - Безопасность
  - Требования к коду и тестированию
  - Деплой и эксплуатация

## Спецификации API

### Frontend API Specification
- **Папка:** [`ABOUT/API_SPEC_FRONT/`](../../ABOUT/API_SPEC_FRONT/)
- **Описание:** Полная спецификация публичного API для фронтенд приложения
- **Базовый URL:** Настраивается через переменные окружения (по умолчанию `/api`)
- **Доступность:** Публичный API, доступен из интернета

#### Структура документации Frontend API:

1. **[README.md](../../ABOUT/API_SPEC_FRONT/README.md)** — Обзор и навигация по документации
2. **[00-introduction.md](../../ABOUT/API_SPEC_FRONT/00-introduction.md)** — Введение, общие принципы, формат ответов
3. **[01-authentication.md](../../ABOUT/API_SPEC_FRONT/01-authentication.md)** — Аутентификация (Discord OAuth, email/password)
4. **[02-public-endpoints.md](../../ABOUT/API_SPEC_FRONT/02-public-endpoints.md)** — Публичные эндпоинты (features, pricing, documentation, stats)
5. **[03-user-endpoints.md](../../ABOUT/API_SPEC_FRONT/03-user-endpoints.md)** — Управление профилем текущего пользователя
6. **[04-guild-endpoints.md](../../ABOUT/API_SPEC_FRONT/04-guild-endpoints.md)** — Управление Discord серверами (гильдиями) и статистика
7. **[05-team-endpoints.md](../../ABOUT/API_SPEC_FRONT/05-team-endpoints.md)** — Управление командами и совместная работа
8. **[06-billing-endpoints.md](../../ABOUT/API_SPEC_FRONT/06-billing-endpoints.md)** — Подписки, лимиты использования, счета
9. **[07-analytics-endpoints.md](../../ABOUT/API_SPEC_FRONT/07-analytics-endpoints.md)** — Данные аналитики и heatmap для гильдий
10. **[08-leaderboard-endpoints.md](../../ABOUT/API_SPEC_FRONT/08-leaderboard-endpoints.md)** — Данные рейтингов для гильдий
11. **[09-counter-endpoints.md](../../ABOUT/API_SPEC_FRONT/09-counter-endpoints.md)** — Управление каунтерами (stat, goal, clock)
12. **[10-widget-endpoints.md](../../ABOUT/API_SPEC_FRONT/10-widget-endpoints.md)** — Создание и управление виджетами
13. **[11-settings-endpoints.md](../../ABOUT/API_SPEC_FRONT/11-settings-endpoints.md)** — Настройки серверов
14. **[12-error-codes.md](../../ABOUT/API_SPEC_FRONT/12-error-codes.md)** — Полный список кодов ошибок
15. **[13-data-types.md](../../ABOUT/API_SPEC_FRONT/13-data-types.md)** — TypeScript интерфейсы и определения типов данных

### Admin API Specification
- **Папка:** [`ABOUT/API_SPEC_ADMIN/`](../../ABOUT/API_SPEC_ADMIN/)
- **Описание:** Полная спецификация административного API для внутреннего управления системой
- **Базовый URL:** Настраивается через переменные окружения (по умолчанию `https://api.server.ninja`)
- **Доступность:** Закрыт под VPN, недоступен из интернета

#### Структура документации Admin API:

1. **[README.md](../../ABOUT/API_SPEC_ADMIN/README.md)** — Обзор и навигация по документации
2. **[00-introduction.md](../../ABOUT/API_SPEC_ADMIN/00-introduction.md)** — Введение, общая информация, формат ответов
3. **[auth.md](../../ABOUT/API_SPEC_ADMIN/auth.md)** — Эндпоинты аутентификации (login, me, logout)
4. **[dashboard.md](../../ABOUT/API_SPEC_ADMIN/dashboard.md)** — Обзорная статистика дашборда
5. **[analytics.md](../../ABOUT/API_SPEC_ADMIN/analytics.md)** — Эндпоинты аналитики (counters, widgets, growth, commands, leaderboards)
6. **[users.md](../../ABOUT/API_SPEC_ADMIN/users.md)** — Управление пользователями
7. **[guilds.md](../../ABOUT/API_SPEC_ADMIN/guilds.md)** — Управление гильдиями
8. **[system-health.md](../../ABOUT/API_SPEC_ADMIN/system-health.md)** — Мониторинг системы (shards, queues, logs)
9. **[data-types.md](../../ABOUT/API_SPEC_ADMIN/data-types.md)** — TypeScript типы, enums и интерфейсы
10. **[error-codes.md](../../ABOUT/API_SPEC_ADMIN/error-codes.md)** — Полный список кодов ошибок
11. **[implementation-notes.md](../../ABOUT/API_SPEC_ADMIN/implementation-notes.md)** — Заметки для разработчиков бекенда

## Спецификации разработки

### Спецификации по разделам ТЗ
- **Папка:** [`spec/`](../)
- **Описание:** Детальные спецификации для каждого раздела технического задания
- **Формат:** Отдельные файлы для каждого пункта ТЗ

#### Текущие спецификации:

1. **[01-01-naznachenie-sistemy.md](../01-01-naznachenie-sistemy.md)** — Назначение системы
2. **[01-02-glossarij.md](../01-02-glossarij.md)** — Глоссарий терминов
3. **[01-03-ssylki-na-dokumentaciyu.md](../01-03-ssylki-na-dokumentaciyu.md)** — Ссылки на документацию (этот файл)

*Примечание: По мере разработки будут добавляться новые спецификации для остальных разделов ТЗ.*

## Внешние ресурсы

### Discord API Documentation
- **Официальная документация:** [https://discord.com/developers/docs](https://discord.com/developers/docs)
- **Discord.js Documentation:** [https://discord.js.org](https://discord.js.org)
- **Версия API:** Discord API v10+

### Технологии и фреймворки

#### Backend
- **NestJS:** [https://nestjs.com](https://nestjs.com)
- **TypeScript:** [https://www.typescriptlang.org](https://www.typescriptlang.org)
- **Node.js:** [https://nodejs.org](https://nodejs.org) (v20+)

#### Базы данных
- **PostgreSQL:** [https://www.postgresql.org](https://www.postgresql.org) (v15+)
- **ClickHouse:** [https://clickhouse.com](https://clickhouse.com)
- **Redis:** [https://redis.io](https://redis.io)

#### Инструменты
- **BullMQ:** [https://docs.bullmq.io](https://docs.bullmq.io) (очереди задач)
- **Docker:** [https://www.docker.com](https://www.docker.com)
- **DigitalOcean:** [https://www.digitalocean.com](https://www.digitalocean.com)

## Дизайн и UI

### Figma (если доступно)
- **Ссылка:** *Требуется указать ссылку на дизайн в Figma*
- **Описание:** Макеты пользовательского интерфейса, компоненты, стили

## Репозитории

### Frontend Repository (если доступно)
- **Ссылка:** *Требуется указать ссылку на репозиторий фронтенда*
- **Описание:** Исходный код фронтенд приложения

### Backend Repository
- **Текущий репозиторий:** Этот репозиторий содержит бекенд код и документацию

## Полезные ссылки

### Стандарты и соглашения
- **ISO 8601 (формат даты):** [https://en.wikipedia.org/wiki/ISO_8601](https://en.wikipedia.org/wiki/ISO_8601)
- **REST API Best Practices:** [https://restfulapi.net](https://restfulapi.net)
- **JWT (JSON Web Tokens):** [https://jwt.io](https://jwt.io)
- **OAuth 2.0:** [https://oauth.net/2](https://oauth.net/2)

### Безопасность
- **OWASP Top 10:** [https://owasp.org/www-project-top-ten](https://owasp.org/www-project-top-ten)
- **AES Encryption:** [https://en.wikipedia.org/wiki/Advanced_Encryption_Standard](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)

## Обновление документации

Документация должна обновляться синхронно с разработкой. При изменении API или архитектуры необходимо:

1. Обновить соответствующие файлы спецификации
2. Обновить этот документ, если появились новые ссылки
3. Убедиться, что все ссылки актуальны и работают

---

**Последнее обновление:** 2026-01-28
