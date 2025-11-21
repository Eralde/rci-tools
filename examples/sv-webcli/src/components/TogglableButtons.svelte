<script lang="ts">
interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  activeOptions: string[];
  showFullLabels?: boolean;
  optionColors?: Map<string, string>;
}

let {
  options,
  activeOptions = $bindable(),
  showFullLabels = false,
  optionColors,
}: Props = $props();

let activeSet: Set<string> = $derived(new Set(activeOptions));

const toggleOption = (value: string): void => {
  const newActiveOptions = new Set(activeOptions);

  if (newActiveOptions.has(value)) {
    newActiveOptions.delete(value);
  } else {
    newActiveOptions.add(value);
  }

  activeOptions = Array.from(newActiveOptions);
};

const getButtonStyle = (value: string): string => {
  if (!activeSet.has(value) || !optionColors) {
    return '';
  }

  const bgColor = optionColors.get(value) || 'var(--color-primary)';

  return `
    background-color: ${bgColor};
    border-color: ${bgColor};
    color: var(--color-text-white);
  `;
};
</script>

<div class="togglable-buttons-container">
  {#each options as option}
    <button
      class="togglable-button"
      class:active={activeSet.has(option.value)}
      class:has-custom-color={activeSet.has(option.value) && optionColors?.has(option.value)}
      class:show-full-labels={showFullLabels}
      style={getButtonStyle(option.value)}
      onclick={() => toggleOption(option.value)}
      title={option.label}
    >
      <span class="button-label-full">{option.label}</span>
      <span class="button-label-short" aria-label={option.label}>{
        option.label[0]
      }</span>
    </button>
  {/each}
</div>

<style>
.togglable-buttons-container {
  display: flex;
  gap: var(--space-xs);
  min-width: 0; /* allow container to shrink */
  flex-wrap: nowrap;
}

.togglable-button {
  padding: var(--button-padding-small);
  border: 1px solid var(--color-border);
  border-radius: var(--space-xs);
  background-color: var(--color-bg-light-hover);
  cursor: pointer;
  font-size: var(--button-font-small);
  color: var(--color-text-secondary);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 0; /* allow content to shrink */
}

.togglable-button .button-label-full {
  display: none;
}

.togglable-button .button-label-short {
  display: inline-block;
}

.togglable-button.show-full-labels .button-label-full {
  display: inline-block;
}

.togglable-button.show-full-labels .button-label-short {
  display: none;
}

.togglable-button:hover {
  background-color: var(--color-bg-light-active);
  border-color: var(--color-border-medium);
}

.togglable-button.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-white);
}

.togglable-button.active:hover {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.togglable-button.active.has-custom-color:hover {
  opacity: 0.9;
  filter: brightness(0.95);
}
</style>
