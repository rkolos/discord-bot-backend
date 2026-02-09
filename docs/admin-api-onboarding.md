# Онбординг: подключение к Admin API

Краткая шпаргалка для разработчика админ-панели: где документация, куда слать запросы и как авторизоваться.

---

## 1. Документация API

**OpenAPI (Swagger):** файл **`/Users/user/Documents/discord-stat-bot-backend/docs/openapi-admin.json`** — можно подгрузить в Postman/Insomnia или использовать для генерации клиента.

---

## 2. Куда делать запросы (Base URL)

Базовый URL админского API зависит от окружения:

| Окружение | Base URL | Примечание |
|-----------|----------|------------|
| **Локальная разработка** (без Docker) | `http://localhost:3001` | Запуск: `npm run start:dev:admin-api` |
| **Docker** (docker-compose) | `http://localhost:3002` | Сервис `admin-api`, порт 3002 |

Все эндпоинты идут с префиксом **`/api/`**, например:

- `POST http://localhost:3001/api/auth/login`
- `GET http://localhost:3001/api/auth/me`
- `GET http://localhost:3001/api/dashboard/overview`
- и т.д. — полный список в `ABOUT/API_SPEC_ADMIN/README.md`.

В админ-панели базовый URL лучше брать из переменной окружения (например `NEXT_PUBLIC_ADMIN_API_URL` или `VITE_ADMIN_API_URL` в зависимости от стека), чтобы не хардкодить хост.

---

## 3. Авторизация

1. **Логин:** `POST /api/auth/login` с телом `{ "email", "password" }` → в ответе JWT (или токен в формате, описанном в **auth.md**).
2. **Дальнейшие запросы:** заголовок  
   `Authorization: Bearer <JWT_TOKEN>`.
3. **Проверка сессии:** `GET /api/auth/me`.
4. **Выход:** `POST /api/auth/logout` (при необходимости по спецификации).

Детали полей запроса/ответа — в **`ABOUT/API_SPEC_ADMIN/auth.md`**.

---

## 4. Формат ответов и ошибок

- Успех: тело в формате **Envelope** — например `{ "data": ... }`, для списков с пагинацией — `{ "data": [...], "meta": { "total", "page", "limit", "totalPages" } }`. Подробно в **00-introduction.md**.
- Ошибки: объект `{ "error": { "code", "message", "details?" } }`. Коды — в **error-codes.md**.

---

## 5. CORS и доступ

Admin API рассчитан на внутреннее использование (VPN). Для локальной разработки CORS обычно разрешён на URL админ-панели (переменная `ADMIN_PANEL_URL` в бекенде). Если запросы с фронта блокируются — проверить, что в `.env` бекенда указан корректный `ADMIN_PANEL_URL` (или аналог для разрешённого origin).

---

**Итого:** документация — **`/Users/user/Documents/discord-stat-bot-backend/docs/openapi-admin.json`**, запросы — на **Base URL** (локально `http://localhost:3001` или `http://localhost:3002` в Docker), все пути с префиксом **`/api/`**, авторизация — Bearer JWT после логина по **auth.md**.
