# mobile-backend — бэкенд приложения «Дебюты Го 9×9»

Минимальный FastAPI-сервис по спецификации `docs/app-spec.md` §6:
вход по email-коду, дневной лимит бесплатного тарифа, вебхук RevenueCat,
синхронизация прогресса. SQLite, JWT — рассчитан на один маленький
контейнер на Hetzner рядом с остальными сервисами репозитория.

## Запуск

```sh
pip install -r requirements.txt
DEV_MODE=1 uvicorn app.main:app --port 8080   # коды печатаются в лог
pytest tests/ -q                               # тесты
```

Приложение указывает на сервис переменной `EXPO_PUBLIC_API_URL`
(без неё клиент работает офлайн в гостевом режиме).

## Переменные окружения

| Переменная | Что делает |
| --- | --- |
| `APP_SECRET` | секрет подписи JWT (обязателен в проде) |
| `DB_PATH` | путь к sqlite-файлу (по умолчанию `mobile.db`) |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | отправка писем с кодом; без SMTP код печатается в лог (только dev) |
| `DEV_MODE=1` | код возвращается прямо в ответе `/auth/request-code` |
| `RC_WEBHOOK_SECRET` | секрет вебхука RevenueCat |
| `FREE_DAILY_LIMIT` | лимит бесплатного тарифа (по умолчанию 3) |

## API

```
POST /auth/request-code      {email}                → {ok}       (+dev_code в DEV_MODE)
POST /auth/verify            {email, code}          → {token}    JWT на 30 дней
GET  /me                     Bearer                 → {email, plan, daily_used, daily_limit}
POST /usage/opening-identified {opening_id}  Bearer → {allowed, daily_used, daily_limit}
POST /billing/webhook        RevenueCat event       → переключает plan free/pro
GET  /progress | PUT /progress  Bearer              → JSON прогресса
```

Правила лимита: считаются только *разные* дебюты за локальный день;
повтор дебюта не тратит слот; `plan=pro` — без ограничений.
