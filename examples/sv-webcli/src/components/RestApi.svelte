<script lang="ts">
import CodeMirror from 'svelte-codemirror-editor';
import {json} from '@codemirror/lang-json';
import {parse} from 'relaxed-json';
import {copyToClipboard} from '../utils';
import {type HistoryItem, type HttpMethod, historyService} from '../services';
import {Button} from './index.ts';

const DEFAULT_PAYLOAD = '{}';

let method: HttpMethod = $state('POST');
let requestUrl = $state('');
let requestData = $state(DEFAULT_PAYLOAD);

let responseTextarea: HTMLTextAreaElement;

let historyIndex = $state<number | null>(null);
let hasResponse = $state(false);

const isValidJson = $derived.by(() => {
  try {
    parse(requestData);
    return true;
  } catch {
    return false;
  }
});

const isFormValid = $derived.by(() => {
  // For POST requests, JSON must be valid
  // Resource URL can be empty or non-empty (both are valid)
  if (method === 'POST' && !isValidJson) {
    return false;
  }
  return true;
});

const navigateHistory = (direction: 'up' | 'down'): void => {
  const history = historyService.loadHistory();
  if (history.length === 0) { return; }

  if (historyIndex === null) {
    // Start navigating from the end
    historyIndex = history.length - 1;
  } else {
    if (direction === 'up') {
      historyIndex = Math.max(0, historyIndex - 1);
    } else {
      historyIndex = Math.min(history.length - 1, historyIndex + 1);
      if (historyIndex === history.length - 1) {
        // Reached the end, clear the form
        historyIndex = null;
        method = 'POST';
        requestUrl = '';
        requestData = DEFAULT_PAYLOAD;
        setTextareaContents('');
        hasResponse = false;
        return;
      }
    }
  }

  const item = history[historyIndex];
  if (item) {
    method = item.method;
    requestUrl = item.resourceUrl;
    if (item.requestData) {
      requestData = item.requestData;
    } else {
      requestData = DEFAULT_PAYLOAD;
    }
    setTextareaContents(item.response);
    hasResponse = true;
  }
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    navigateHistory(event.key === 'ArrowUp' ? 'up' : 'down');
  } else if (event.key === 'Enter' && isFormValid) {
    event.preventDefault();
    sendRequest();
  }
};

const handleMethodKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' && isFormValid) {
    event.preventDefault();
    sendRequest();
  }
};

const setTextareaContents = (text: string): void => {
  if (responseTextarea) {
    responseTextarea.value = text;
  }
};

const sendRequest = () => {
  const json = parse(requestData);
  const requestDataStr = method === 'POST'
    ? JSON.stringify(json)
    : undefined;

  fetch(`/rci/${requestUrl}`, {method, body: requestDataStr})
    .then((res) => res.text())
    .then((text) => {
      setTextareaContents(text);
      hasResponse = true;

      // Save to history
      const historyItem: HistoryItem = {
        method,
        resourceUrl: requestUrl,
        requestData: method === 'POST' ? requestDataStr : undefined,
        response: text,
        timestamp: Date.now(),
      };
      historyService.addToHistory(historyItem);
      // Reset navigation index when a new item is added or updated
      historyIndex = null;
    })
    .catch((error) => {
      const errorText = `Error: ${error.message}`;
      setTextareaContents(errorText);
      hasResponse = true;

      // Save error to history as well
      const historyItem: HistoryItem = {
        method,
        resourceUrl: requestUrl,
        requestData: method === 'POST' ? requestData : undefined,
        response: errorText,
        timestamp: Date.now(),
      };
      historyService.addToHistory(historyItem);
      // Reset navigation index when a new item is added or updated
      historyIndex = null;
    });
};

const reformatJson = () => {
  try {
    const parsed = parse(requestData);

    requestData = JSON.stringify(parsed, null, 2);
  } catch {
    // If invalid JSON, do nothing
  }
};

const resetJson = () => {
  requestData = DEFAULT_PAYLOAD;
};

const copyResponse = () => {
  if (responseTextarea) {
    copyToClipboard(responseTextarea.value);
  }
};

const clearResponse = () => {
  setTextareaContents('');
  hasResponse = false;
};
</script>

<div class="rest-api-container">
  <div class="controls">
    <div class="method-selection">
      <label>
        <input
          type="radio"
          bind:group={method}
          value="POST"
          onkeydown={handleMethodKeyDown}
        />
        POST
      </label>

      <label>
        <input
          type="radio"
          bind:group={method}
          value="GET"
          onkeydown={handleMethodKeyDown}
        />
        GET
      </label>
      <label>
        <input
          type="radio"
          bind:group={method}
          value="DELETE"
          onkeydown={handleMethodKeyDown}
        />
        DELETE
      </label>

      <Button
        variant="primary"
        size="regular"
        onclick={sendRequest}
        disabled={!isFormValid}
      >
        Send
      </Button>
    </div>
    <div class="url-input">
      <label for="resource-url">/rci/</label>
      <input
        id="resource-url"
        type="text"
        bind:value={requestUrl}
        onkeydown={handleKeyDown}
      />
    </div>
  </div>
  <div class="data">
    <div
      hidden={method !== 'POST'}
      class="request-area"
    >
      <div class="request-header">
        <div class="request-label">Request</div>
        <div class="request-buttons">
          <Button
            variant="secondary"
            size="small"
            onclick={reformatJson}
          >
            Reformat
          </Button>
          <Button
            variant="secondary"
            size="small"
            onclick={() => copyToClipboard(requestData)}
          >
            Copy
          </Button>

          <Button
            variant="secondary"
            size="small"
            onclick={resetJson}
          >
            Clear
          </Button>
        </div>
      </div>
      <div class="json-editor" class:invalid={!isValidJson}>
        <CodeMirror
          class="editor"
          bind:value={requestData}
          lang={json()}
        />
      </div>
    </div>

    <div
      class="response-area"
      hidden={!hasResponse}
      class:full-width={method !== 'POST'}
    >
      <div class="response-header">
        <label for="response-label">Response</label>
        <div class="response-buttons">
          <Button
            variant="secondary"
            size="small"
            onclick={copyResponse}
          >
            Copy
          </Button>
          <Button
            variant="secondary"
            size="small"
            onclick={clearResponse}
          >
            Clear
          </Button>
        </div>
      </div>
      <textarea
        id="response-label"
        bind:this={responseTextarea}
        readonly
      >
      </textarea>
    </div>
  </div>
</div>

<style>
.rest-api-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-lg);
  gap: var(--space-lg);
  box-sizing: border-box;
  overflow: hidden;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.method-selection {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
}

.method-selection label {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  cursor: pointer;
}


.url-input {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.url-input input {
  padding: var(--space-sm);
  font-family: monospace;
  width: 60ch;
}

.data {
  display: flex;
  flex-direction: row;
  gap: var(--space-3xl);
  flex: 1;
  min-height: 0;
}

.request-area:not([hidden]) {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: var(--space-sm);
  max-width: calc(50% - var(--space-lg));
  height: 100%;
}

.request-header ,
.response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.request-buttons,
.response-buttons {
  display: flex;
  gap: var(--space-md);
}


.json-editor {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--space-xs);
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.json-editor.invalid {
  border-color: var(--color-danger);
}

:global(.editor) {
  flex: 1;
  min-height: 0;
}

:global(.editor .cm-editor) {
  height: 100%;
  font-size: var(--font-size-sm);
}

.response-area:not([hidden]) {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  height: 100%;
}

.response-area:not(.full-width) {
  max-width: calc(50% - var(--space-lg));
}

.response-area.full-width {
  max-width: 100%;
}

.response-area textarea {
  flex: 1;
  padding: var(--space-sm);
  font-family: monospace;
  font-size: var(--font-size-sm);
  resize: none;
  border: 1px solid var(--color-border);
  border-radius: var(--space-xs);
}
</style>
