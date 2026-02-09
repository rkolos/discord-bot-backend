# Изменения Admin API: экран Queue Metrics (System → Queues)

**Дата:** 2025-02-02  
**Для:** разработчик админ-панели  
**Тема:** обновление бекенда для экрана «Queue Metrics» (System → Queues).

---

## Кратко

Контракт API **не изменился**: пути, методы, формат ответов и типы остались прежними. Изменилось только **количество и состав очередей**, которые возвращает бекенд. Достаточно убедиться, что UI корректно отображает все приходящие очереди.

---

## 1. Что изменилось на бекенде

### GET /api/system/queues

- **Путь:** `GET /api/system/queues` — без изменений.
- **Формат ответа:** `{ data: IQueueMetrics[] }` — без изменений.
- **Изменение:** в массиве `data` теперь **7 очередей** вместо 6. Добавлена очередь `workers-queue-welcome-goodbye-config`.

Полный список очередей, которые возвращает API:

| № | queueName |
|---|-----------|
| 1 | `workers-queue-counters-update` |
| 2 | `workers-queue-guild-setup` |
| 3 | `workers-queue-history-sync` |
| 4 | `ingestor-raw-events` |
| 5 | `workers-queue-logs-config` |
| 6 | `workers-queue-welcome-goodbye-config` *(новая)* |
| 7 | `workers-queue-gdpr-user-delete` |

Тип элемента массива по-прежнему `IQueueMetrics`:

```ts
interface IQueueMetrics {
  queueName: string;   // идентификатор очереди (см. таблицу выше)
  active: number;      // джобы в обработке
  waiting: number;     // в ожидании
  delayed: number;     // отложенные
  failed: number;      // проваленные
  paused: boolean;     // очередь на паузе
}
```

### POST /api/system/queues/:queueName/retry-failed

- **Путь:** `POST /api/system/queues/:queueName/retry-failed` — без изменений.
- **Параметр:** `queueName` в URL — то же значение, что в `IQueueMetrics.queueName` (любая из 7 очередей выше).
- **Тело запроса:** не требуется.
- **Ответ при успехе:** `200 OK`, тело в формате `{ data: { success: true, retriedCount: number } }`.
- **Ошибки:** `404 Not Found` с кодом `QUEUE_NOT_FOUND`, если очередь не найдена.

Для новой очереди `workers-queue-welcome-goodbye-config` retry работает так же, как для остальных.

---

## 2. Что нужно сделать на фронте

### Обязательно

- Ничего менять в запросах не нужно: URL и заголовки те же.
- Убедиться, что список очередей строится **только из ответа API** (массив `data`), без жёсткого списка имён на фронте. Тогда седьмая очередь будет автоматически появляться в UI (карточка, метрики, кнопка «Retry Failed Jobs» при `failed > 0`).

### Опционально

- Если в коде есть **жёсткий список** имён очередей (для отображения подписей, сортировки или фильтров), добавить в него `workers-queue-welcome-goodbye-config`. Для отображения названия на карточке по-прежнему можно заменять `-` на пробел (например, «Workers Queue Welcome Goodbye Config» или сокращённо по договорённости).
- Типы/интерфейсы на фронте можно сверить с [ABOUT/API_SPEC_ADMIN/data-types.md](../ABOUT/API_SPEC_ADMIN/data-types.md) (раздел `IQueueMetrics`) и [system-health.md](../ABOUT/API_SPEC_ADMIN/system-health.md) — там актуальные примеры с реальными именами очередей.

---

## 3. Поведение, которое не менялось

- Polling: фронт по-прежнему может опрашивать `GET /api/system/queues` с нужным интервалом (например, раз в 5 секунд). Бекенд не кеширует ответ агрессивно, данные актуальные.
- Кнопка «Retry Failed Jobs»: логика та же — активна при `failed > 0`, вызов `POST /api/system/queues/:queueName/retry-failed`, после успеха — инвалидация кеша и повторный запрос метрик.
- Ошибки: по-прежнему в Envelope-формате `{ error: { code, message, details? } }`; для retry при неизвестной очереди — 404 и код `QUEUE_NOT_FOUND`.

---

## 4. Спецификация и примеры

- Эндпоинты и примеры ответов: [ABOUT/API_SPEC_ADMIN/system-health.md](../ABOUT/API_SPEC_ADMIN/system-health.md) (разделы GET /api/system/queues, GET /api/system/queues/stalled, POST /api/system/queues/:name/retry-failed).
- Типы: [ABOUT/API_SPEC_ADMIN/data-types.md](../ABOUT/API_SPEC_ADMIN/data-types.md) (`IQueueMetrics`, `IStalledJob`).

Если экран Queue Metrics уже использует эти эндпоинты и рендерит карточки по массиву из `data`, достаточно обновить фронт до версии бекенда с этими изменениями — седьмая очередь появится автоматически.

---

## 5. Диагностика: все метрики очередей = 0

Если при подключённом боте и реальном сервере в админке на экране Queues все показатели (active, waiting, delayed, failed) равны 0 у всех очередей, значит Admin API читает очереди **не в том Redis или с другим префиксом**, чем сервисы, которые в них пишут (bot-service, frontend-api, ingestor-worker).

### Как устроен префикс

- Очереди BullMQ в Redis имеют ключи вида: **`{prefix}{queueName}:...`**
- Префикс задаётся из **NODE_ENV**: `sn:dev:`, `sn:prod:`, `sn:stage:`, `sn:test:`
- Пример: при `NODE_ENV=development` префикс `sn:dev:`, ключи вида `sn:dev:workers-queue-counters-update:wait` и т.д.

Если Admin API запущен с **другим NODE_ENV**, чем bot-service/frontend-api/ingestor-worker, он будет смотреть в другой «набор» очередей (другой префикс), где джобов нет — поэтому везде 0.

### Что проверить

1. **NODE_ENV** у процесса Admin API и у процессов bot-service, frontend-api, ingestor-worker должен быть **одинаковым** (все `development`, или все `production`, и т.д.). Иначе префиксы будут разными (например `sn:prod:` у admin и `sn:dev:` у бота).
2. **REDIS_HOST** и **REDIS_PORT** у Admin API должны совпадать с теми, к которым подключаются bot-service и frontend-api (тот же инстанс Redis).
3. При старте Admin API в логах теперь есть строка вида:  
   `Connecting to queues at <host>:<port> with prefix "<prefix>" (NODE_ENV should match bot-service/frontend-api)`  
   Сверьте `prefix` с тем, что используют воркеры (в их логах или через переменные окружения).

### Итог

- Одинаковые **NODE_ENV** и **REDIS_HOST/REDIS_PORT** у admin-api и у сервисов с очередями → метрики появятся.
- После исправления окружения перезапустите Admin API и обновите страницу Queues.
