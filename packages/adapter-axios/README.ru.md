[English](README.md) | **Русский**

# `@rci-tools/adapter-axios`

Реализация HTTP-транспорта на основе Axios для `@rci-tools/core`.

## Установка

```bash
npm install @rci-tools/adapter-axios
```

## Использование

```typescript
import {AxiosTransport} from '@rci-tools/adapter-axios';
import {SessionManager, RciManager} from '@rci-tools/core';

const transport = new AxiosTransport();
const host = 'http://192.168.1.1';

const sessionManager = new SessionManager(host, transport);
const rciManager = new RciManager(host, transport);

// Используйте sessionManager и rciManager как обычно
```
