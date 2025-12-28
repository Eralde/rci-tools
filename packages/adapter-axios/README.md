**English** | [Русский](README.ru.md)

# `@rci-tools/adapter-axios`

Axios-based HTTP transport implementation for `@rci-tools/core`.

## Installation

```bash
npm install @rci-tools/adapter-axios
```

## Usage

```typescript
import {AxiosTransport} from '@rci-tools/adapter-axios';
import {SessionManager, RciManager} from '@rci-tools/core';

const transport = new AxiosTransport();
const host = 'http://192.168.1.1';

const sessionManager = new SessionManager(host, transport);
const rciManager = new RciManager(host, transport);

// Use sessionManager and rciManager as usual
```

