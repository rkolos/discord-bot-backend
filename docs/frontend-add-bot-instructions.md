# Инструкция: Добавление бота на сервер (Add Bot)

Инструкция для фронтенд‑разработчика по корректной сборке ссылки для редиректа пользователя в Discord при установке бота на сервер.

---

## 1. Endpoint бэкенда

```
GET {API_BASE_URL}/api/auth/discord/add-bot
```

**Примеры:**
- Dev: `http://localhost:3001/api/auth/discord/add-bot`
- Prod: `https://api.your-domain.com/api/auth/discord/add-bot`

---

## 2. Обязательные query‑параметры

### `redirect_uri` (обязательный)

URL страницы фронтенда, на которую пользователь будет перенаправлен **после** завершения OAuth в Discord.

**Требования:**
- Должен совпадать с `FRONTEND_BASE_URL` в `.env` бэкенда (origin + path)
- Path должен быть **точно** `/add-bot/callback` (без trailing slash)

**Примеры (если `FRONTEND_BASE_URL=http://localhost:3010`):**
- ✅ `http://localhost:3010/add-bot/callback`
- ❌ `http://localhost:3010/add-bot/callback/` (лишний слэш)
- ❌ `http://localhost:3010/dashboard/add-bot` (неверный path)

---

## 3. Необязательные query‑параметры

### `permissions` (опционально)

Числовая строка — битовая маска прав бота на сервере.

- По умолчанию: `8` (Administrator)
- [Discord Permission Calculator](https://discordapi.com/permissions.html) — для подбора нужных прав

---

## 4. Сборка ссылки

### Вариант A: `URLSearchParams`

```typescript
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const frontendOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010';

const params = new URLSearchParams({
  redirect_uri: `${frontendOrigin}/add-bot/callback`,
  // permissions: '8',  // опционально
});

const addBotUrl = `${apiBase}/api/auth/discord/add-bot?${params.toString()}`;

// Редирект
window.location.href = addBotUrl;
```

### Вариант B: шаблонная строка

```typescript
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const frontendOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010';

const redirectUri = encodeURIComponent(`${frontendOrigin}/add-bot/callback`);
const addBotUrl = `${apiBase}/api/auth/discord/add-bot?redirect_uri=${redirectUri}`;

window.location.href = addBotUrl;
```

### Вариант C: с кастомными правами

```typescript
const addBotUrl = `${apiBase}/api/auth/discord/add-bot?` + new URLSearchParams({
  redirect_uri: `${frontendOrigin}/add-bot/callback`,
  permissions: '274877975552', // например: view channels + send messages + read message history
}).toString();
```

---

## 5. Переменные окружения

Настройте на фронте переменные, **совпадающие с `.env` бэкенда**:

| Переменная фронта | Значение в .env бэкенда | Пример |
|-------------------|-------------------------|--------|
| `NEXT_PUBLIC_API_URL` / `VITE_API_URL` | URL frontend-api (порт 3001) | `http://localhost:3001` |
| `NEXT_PUBLIC_APP_URL` / `VITE_APP_URL` | `FRONTEND_BASE_URL` | `http://localhost:3010` |

**Важно:** Origin фронта и `FRONTEND_BASE_URL` должны совпадать. Иначе бэкенд вернёт 400 `redirect_uri must be {FRONTEND_BASE_URL}/add-bot/callback`.

---

## 6. Страница callback `/add-bot/callback`

После успешной установки бота бэкенд редиректит на:

```
{redirect_uri}?token={JWT}&guildId={UUID}
```

При ошибке:

```
{redirect_uri}?error=OAUTH_FAILED
```

или

```
{redirect_uri}?error=GUILD_ONBOARD_FAILED
```

**На callback‑странице:**
1. Пользователь уже авторизован (бэкенд установил cookie `refresh_token`). Токен в URL можно игнорировать.
2. При наличии `guildId` — перенаправить в дашборд гильдии.
3. При наличии `error` — показать сообщение об ошибке, затем перенаправить в дашборд.

---

## 7. Краткая схема

```
Пользователь нажимает «Добавить бота»
        ↓
Фронт делает redirect на:
  GET {API_BASE}/api/auth/discord/add-bot?redirect_uri={FRONTEND_ORIGIN}/add-bot/callback
        ↓
Бэкенд редиректит в Discord
        ↓
Пользователь выбирает сервер в Discord
        ↓
Discord редиректит на бэкенд (/api/auth/discord/callback)
        ↓
Бэкенд вызывает onboard и редиректит на фронт:
  {FRONTEND_ORIGIN}/add-bot/callback?token=...&guildId=...
  (токен в URL опционален; сессия уже установлена через cookie)
```

# --- Add Bot: для передачи фронтенд-разработчику ---
# Фронт должен настроить переменные, совпадающие с этими значениями:
#   API_BASE_URL (URL бэкенд API) = http://localhost:3001  (порт frontend-api)
#   FRONTEND_BASE_URL (origin фронтенда) = http://localhost:3010