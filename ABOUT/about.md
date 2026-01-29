# Структура Технического Задания (ТЗ) на разработку Backend для Server.Ninja

## 1\. Введение и Цели проекта ✅

_В этом разделе описывается контекст, чтобы разработчик понимал "что" и "зачем" мы строим._

-   **1.1. Назначение системы:** ✅ Краткое описание продукта (платформа управления Discord-ботами, аналитика, каунтеры). _См. `spec/01-01-naznachenie-sistemy.md`_
    
-   **1.2. Глоссарий:** ✅ Определение терминов (Guild, Counter, Shard, Widget, Ingestor, Materialized View), чтобы все говорили на одном языке. _См. `spec/01-02-glossarij.md`_
    
-   **1.3. Ссылки на документацию:** ✅ Ссылки на дизайн (Figma), спецификацию API (Swagger/Markdown файлы) и фронтенд-репозиторий. _См. `spec/01-03-ssylki-na-dokumentaciyu.md`_
    

## 2\. Архитектурное решение (System Design)

_Раздел описывает, как компоненты системы связаны друг с другом._

-   **2.1. Cхема архитектуры:** ✅ Описана общая схема компонентов и их взаимодействие. _См. `spec/02-01-shema-arhitektury.md`_
    
-   **2.2. Описание компонентов:** ✅ Описаны детали Frontend API, Admin API, Bot Service и воркеров. _См. `spec/02-02-opisanie-komponentov.md`_
        
-   **2.3. Потоки данных (Data Flow):** ✅ Описаны потоки событий и команд, включая раздельные адреса Frontend/Admin API. _См. `spec/02-03-potoki-dannyh.md`_
    
    -   Схематично описать путь события: `Discord GW -> Bot -> Redis Stream -> Ingestor -> ClickHouse`.
        
    -   Схематично описать путь команды: `API -> Redis/DB -> Bot -> Discord API`.
        

## 3\. Стек технологий и требования к окружению

_Фиксация версий и инструментов из твоего описания._

-   **3.1. Язык и Фреймворк:** ✅ Node.js v20+, TypeScript, NestJS (описать требуемую модульную структуру: Monorepo или Polyrepo). _См. `spec/03-01-yazyk-i-freymvork.md`_
    
-   **Примечание:** Frontend API и Admin API размещаются на разных адресах; Admin API доступен только через VPN, базовые URL задаются через переменные окружения.
    
-   **3.2. Базы данных:** ✅ PostgreSQL 15+, ClickHouse, Redis, требования к доступу, бэкапам и изоляции окружений. _См. `spec/03-02-bazy-dannyh.md`_

-   **Примечание:** Frontend API размещается на публичном адресе, Admin API — на внутреннем адресе, доступном только через VPN; базовые URL задаются через переменные окружения.
    
    -   PostgreSQL 15+ (Transactional).
        
    -   ClickHouse (OLAP/Analytics).
        
    -   Redis (Cache & Message Broker).
        
-   **3.3. Инфраструктура:** ✅ Docker, DigitalOcean Droplets (требования к ресурсам). _См. `spec/03-03-infrastruktura.md`_
    
-   **3.4. Локальная разработка (Colima):** ✅ Использование Colima вместо Docker Desktop на macOS, настройка DOCKER_HOST, сборка и тесты. _См. `spec/03-04-colima-razrabotka.md`_
    

## 4\. Проектирование Баз Данных

_Здесь детализируется твое описание схемы БД. Необходимо указать, что именно разработчик должен реализовать._

-   **4.1. PostgreSQL (Transactional Layer):** ✅ _См. `spec/04-01-postgresql.md`_
    
    -   Привести список таблиц (`users`, `guilds`, `counters` и др.) с типами данных.
        
    -   **Требование:** Описать связи (Foreign Keys) и индексы для оптимизации выборок по `guild_id` и `user_id`.
        
    -   **Требование:** Реализовать JSONB-валидацию для полей настроек (`settings`, `config`).
        
-   **4.2. ClickHouse (Analytical Layer):** ✅ _См. `spec/04-02-clickhouse.md`_
    
    -   Описать таблицу `raw_events` (движок MergeTree, партиционирование, ключи сортировки).
        
    -   **Materialized Views:** Четко описать SQL-запросы для агрегации данных (`mv_daily_activity`, `mv_role_stats`, `mv_heatmap`, `mv_command_stats`), так как это критическая бизнес-логика.
        
-   **4.3. Redis Schema:** ✅ _См. `spec/04-03-redis-schema.md`_
    
    -   Описать структуру ключей для сессий (`auth:session:...`).
        
    -   Описать нейминг для Streams и BullMQ очередей.
        

## 5\. Описание API и Контрактов

_Поскольку список методов уже есть, здесь описываются общие правила._

-   **5.1. Стандарты взаимодействия:** ✅ REST, JSON, CamelCase. _См. `spec/05-01-standarty-vzaimodejstviya.md`_
    
-   **5.2. Обработка ошибок:** ✅ Ссылка на файл `12-error-codes.md`. Требование реализовать глобальный `ExceptionFilter` в NestJS, который приводит все ошибки к единому Envelope-формату (`{ error: { code, message } }`). _См. `spec/05-02-obrabotka-oshibok.md`_
    
-   **5.3. Валидация:** ✅ Требование использовать `class-validator` и DTO для всех входных данных. _См. `spec/05-03-validaciya.md`_
    
-   **5.4. Пагинация и Сортировка:** ✅ Описать единый подход (query params `page`, `limit`, `sortBy`) и формат ответа с мета-данными. _См. `spec/05-04-paginaciya-sortirovka.md`_
    
-   **5.5. Спецификация методов:** ✅ Реализовать контроллеры в строгом соответствии с приложенными MD-файлами: _См. `spec/05-05-specifikaciya-metodov.md`_
    
    -   **Frontend API:** Спецификация находится в папке `API_SPEC_FRONT/`. Реализовать как отдельное NestJS приложение (Frontend API Service) на публичном адресе.
        
    -   **Admin API:** Спецификация находится в папке `API_SPEC_ADMIN/`. Реализовать как отдельное NestJS приложение (Admin API Service) на внутреннем адресе, закрытом под VPN.
    

## 6\. Реализация бизнес-логики (Core Logic)

_Самый важный раздел. Описывает "как это работает" внутри._

-   **6.1. Система Аутентификации:** ✅ _См. `spec/06-01-sistema-autentifikacii.md`_
    
    -   Реализация JWT (Access) + Refresh Token (HttpOnly Cookie + Hash в БД).
        
    -   Логика ротации токенов и отзыва (`is_revoked`).
        
    -   Интеграция с Discord OAuth2.
        
-   **6.2. Event Pipeline (Обработка событий):** ✅ _См. `spec/06-02-event-pipeline.md`_
    
    -   Логика анонимизации данных перед записью в Redis (Privacy First).
        
    -   Механизм батчинга (пакетной вставки) в ClickHouse Ingestor'ом.
        
    -   Обработка Backpressure (что делать, если ClickHouse недоступен).
        
-   **6.3. Система Каунтеров (Live Counters):** ✅ _См. `spec/06-03-sistema-kaunterov.md`_
    
    -   Логика формирования очередей в BullMQ.
        
    -   Реализация Rate Limiter'а (Discord API limits: 2 updates / 10 min).
        
    -   Алгоритм: Fetch Aggregates from ClickHouse -> Format Template -> Update Discord Channel Name.
        
-   **6.4. Управление ботами (Bot Fleet):** ✅ _См. `spec/06-04-upravlenie-botami.md`_
    
    -   Shared Instance vs Premium Instance.
        
    -   Логика шардирования (ShardingManager).
        
    -   Обработка ошибок подключения (обновление статусов в БД при `401 Unauthorized`).
        

## 7\. Интеграции

_Правила работы с внешними сервисами._

-   **7.1. Discord Gateway & REST API:** ✅ _См. `spec/07-01-discord-gateway-rest.md`_
    
    -   Версия API Discord (v10+).
        
    -   Список необходимых Intents (включая Privileged `GUILD_MEMBERS`).
        
    -   Обработка Rate Limits (использование Redis для распределенного рейт-лимита, если ботов много).
        
-   **7.2. Платежная система (Billing MVP):** ✅ _См. `spec/07-02-platezhnaya-sistema-billing-mvp.md`_
    
    -   Реализация таблицы `companies` и логики ручного переключения планов (как указано в вводных).
        
    -   Задел на будущее: Webhooks от Stripe (интерфейсы).
        

## 8\. Безопасность (Security)

_Требования к защите данных._

-   **8.1. Шифрование:** ✅ Использование AES-256-GCM для хранения `bot_token` в базе. Управление ключами шифрования. _См. `spec/08-01-shifrovanie.md`_
    
-   **8.2. Доступ к данным:** ✅ Реализация Guards (Role-based access control) для проверки прав доступа к гильдии (`TeamMember` role check). _См. `spec/08-02-dostup-k-dannym.md`_
    
-   **8.3. Rate Limiting API:** ✅ Защита эндпоинтов от DDoS (ThrottlerGuard). _См. `spec/08-03-rate-limiting-api.md`_
    

## 9\. Требования к коду и тестированию

_Quality Assurance на уровне кода._

-   **9.1. Структура проекта:** ✅ Описать ожидания по архитектуре папок (например, Hexagonal или стандартная модульная NestJS). _См. `spec/09-01-struktura-proekta.md`_
    
-   **9.2. Тестирование:** ✅ _См. `spec/09-02-testirovanie.md`_
    
    -   Unit-тесты для бизнес-логики (подсчет метрик, валидация).
        
    -   E2E тесты для критических путей (Auth, Create Counter).
        
-   **9.3. Логирование:** ✅ Формат логов (JSON), уровни логирования, маскирование чувствительных данных. _См. `spec/09-03-logirovanie.md`_
    

## 10\. Деплой и Эксплуатация (DevOps)

-   **10.1. Dockerfile:** ✅ Оптимизированные мультистейдж сборки. _См. `spec/10-01-dockerfile.md`_
    
-   **10.2. Миграции:** ✅ Использование TypeORM/Prisma migrations для PG и скриптов для ClickHouse. _См. `spec/10-02-migracii.md`_
    
-   **10.3. Конфигурация:** ✅ Использование `ConfigModule`, валидация переменных окружения (Joi/Zod) при старте приложения. _См. `spec/10-03-konfiguraciya.md`_
    

**Приложения:**

1.  Полная спецификация API (файлы `API_SPEC/*.md`).
    
2.  Схема базы данных (ER-diagram).



