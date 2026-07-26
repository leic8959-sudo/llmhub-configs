# Codex CLI

## Быстрый путь

1. [Создайте аккаунт LLMHub](https://llmhub.vip/sign-up?utm_source=github&utm_medium=partner&utm_campaign=codex-guide), войдите в консоль и откройте [API Keys](https://llmhub.vip/keys).
2. Создайте API-ключ, затем установите Codex CLI и скопируйте готовый блок конфигурации из configs/codex/config.toml в ~/.codex/config.toml.
3. Перед запуском Codex задайте ключ только в текущем окружении:

PowerShell:

    $env:LLMHUB_API_KEY = "<api-key>"
    codex

Linux/macOS:

    export LLMHUB_API_KEY="<api-key>"
    codex

Конфигурация использует OpenAI Responses API и адрес https://llmhub.vip/v1. Модель в примере — gpt-5.6-terra; перед первым запросом проверьте точный ID и доступность через GET /v1/models.

## Проверка до работы с проектом

    export LLMHUB_API_KEY="<api-key>"
    export LLMHUB_MODEL="gpt-5.6-terra"
    node ./bin/llm-api-doctor.mjs

Сначала отправьте короткий запрос без чувствительных файлов и включайте tools только после проверки обычного ответа.
