# n8n

1. Создайте credential типа OpenAI или OpenAI-compatible.
2. API key: ключ LLMHub.
3. Base URL: `https://llmhub.vip/v1`.
4. В узле модели укажите ID из `/v1/models`.
5. Запустите workflow вручную на коротком тестовом входе.
6. Проверьте execution log и usage в кабинете до включения schedule/webhook.

Не сохраняйте ключ в обычном Set/Edit Fields node и не экспортируйте его в
workflow JSON. Для повторов задайте конечный лимит: генеративный запрос может
быть успешно обработан upstream даже при потере клиентского ответа.
