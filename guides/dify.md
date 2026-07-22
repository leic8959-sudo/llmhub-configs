# Dify

1. В workspace откройте настройки model providers.
2. Установите или выберите провайдер для OpenAI-compatible endpoint.
3. Добавьте credentials: base URL `https://llmhub.vip/v1` и ключ LLMHub.
4. Создайте chat model с точным ID из `/v1/models`.
5. Сначала проверьте простой Chatflow без tools и knowledge retrieval.
6. Затем отдельно проверьте streaming, JSON output и tool calls для выбранной
   модели.

Не вставляйте ключ в DSL-файл приложения. Экспортируемый workflow должен
ссылаться на credential, сохранённый в Dify.
