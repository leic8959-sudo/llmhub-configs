# LLMHub Configs

> **Начать работу с LLMHub:** [создать аккаунт и получить $0.50 бесплатного API-кредита](https://llmhub.vip/sign-up?utm_source=github&utm_medium=partner&utm_campaign=github-configs) · [цены](https://llmhub.vip/pricing) · [документация](https://llmhub.vip/docs)

Готовые рецепты подключения OpenAI-совместимого API к инструментам
разработчика и безопасная диагностика соединения. Репозиторий рассчитан на
пользователей, которым важен работающий запрос, а не рекламное описание.

## Первый запрос за 60 секунд

1. [Создайте аккаунт](https://llmhub.vip/sign-up?utm_source=github&utm_medium=partner&utm_campaign=github-configs) и войдите в консоль.
2. Откройте [API Keys](https://llmhub.vip/keys), создайте ключ и сохраните его локально.
3. Получите доступную модель:

```bash
curl https://llmhub.vip/v1/models \
  -H "Authorization: Bearer $LLMHUB_API_KEY"
```

4. Подставьте `MODEL_ID` из ответа и отправьте первый запрос:

```bash
curl https://llmhub.vip/v1/chat/completions \
  -H "Authorization: Bearer $LLMHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"MODEL_ID","messages":[{"role":"user","content":"Say hello in one sentence."}]}'
```

## Что внутри

| Инструмент | Рецепт | Секрет хранится |
| --- | --- | --- |
| Codex CLI | [config.toml](configs/codex/config.toml) | `LLMHUB_API_KEY` |
| Cursor | [пошаговое подключение](guides/cursor.md) | в хранилище Cursor |
| Cline / Roo Code | [пошаговое подключение](guides/cline.md) | в хранилище расширения |
| OpenCode | [opencode.json](configs/opencode/opencode.json) | `LLMHUB_API_KEY` |
| Dify | [пошаговое подключение](guides/dify.md) | в credentials Dify |
| n8n | [пошаговое подключение](guides/n8n.md) | в credentials n8n |

Также включён `llm-api-doctor`: он проверяет авторизацию, `/v1/models`, обычный
ответ, streaming и Responses API. По умолчанию инструмент не выполняет
платный запрос.

## Быстрая диагностика

Требуется Node.js 18 или новее.

PowerShell:

```powershell
$env:LLMHUB_API_KEY = "<api-key>"
$env:LLMHUB_MODEL = "gpt-5.6-terra"
node .\bin\llm-api-doctor.mjs
```

Linux/macOS:

```bash
export LLMHUB_API_KEY="<api-key>"
export LLMHUB_MODEL="gpt-5.6-terra"
node ./bin/llm-api-doctor.mjs
```

Проверка с коротким тарифицируемым запросом:

```bash
node ./bin/llm-api-doctor.mjs --chat --stream
```

Проверка Responses API:

```bash
node ./bin/llm-api-doctor.mjs --responses
```

Добавьте `--json`, если результат нужен для CI или тикета поддержки. Ключ и
полный ответ модели в отчёт не включаются.

## Базовые параметры

```text
Base URL: https://llmhub.vip/v1
API key:  берётся в личном кабинете
Model:    берётся из GET /v1/models или каталога моделей
```

Не копируйте ID модели из старого поста или скриншота: сначала проверьте
доступность для своего аккаунта.

## Партнёрские наборы

Для интеграторов, авторов шаблонов и студий автоматизации есть генератор
отдельного набора с attribution-ссылкой:

```bash
node scripts/generate-partner-kit.mjs \
  --partner example-studio \
  --aff-code ABCD \
  --channel integration
```

Он создаёт локальные Markdown и JSON файлы в `partner-kits/`. Они исключены из
Git, потому что коды и условия должны выдаваться конкретному партнёру после
проверки. Порядок безопасного запуска описан в [OPERATIONS.md](OPERATIONS.md).

## Проверка репозитория

```bash
npm run check
npm test
```

Зависимости устанавливать не нужно.

## Ограничения

- Это не официальный SDK OpenAI, Anthropic, Cursor, Cline, OpenCode, Dify или n8n.
- Поддержка отдельных параметров зависит от выбранной модели и маршрута.
- Интерфейсы сторонних приложений меняются; рецепты содержат проверяемые
  значения, но название пункта меню может отличаться между версиями.
- Цены и доступность сверяйте на <https://llmhub.vip/pricing> перед пополнением.

Документация LLMHub: <https://llmhub.vip/docs>
