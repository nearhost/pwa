<script lang="ts" generics="T extends string">
  // A segmented control: a radio group of a few options, one tab stop (the checked option), whose
  // arrow keys pick the next option and move the focus to it, wrapping round. With fill, the
  // options share the width it is given; on a phone they always do. --segment-height sets the
  // options' height (40px unless set).

  let {
    label,
    options,
    value,
    onchange,
    fill = false,
  }: {
    /** The group's accessible name. */
    label: string;
    options: readonly { id: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
    fill?: boolean;
  } = $props();

  const buttons: HTMLButtonElement[] = $state([]);

  function arrows(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onchange(options[next].id);
    buttons[next]?.focus();
  }
</script>

<div class="segmented" class:fill role="radiogroup" aria-label={label}>
  {#each options as option, i (option.id)}
    <button
      type="button"
      role="radio"
      aria-checked={value === option.id}
      tabindex={value === option.id ? 0 : -1}
      bind:this={buttons[i]}
      onclick={() => onchange(option.id)}
      onkeydown={(event) => arrows(event, i)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-ground);
    border: 1px solid var(--nh-line);
  }

  button {
    min-height: var(--segment-height, 40px);
    padding: 0 14px;
    border: 0;
    border-radius: var(--nh-radius-m);
    background: none;
    color: var(--nh-muted);
    font: inherit;
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  button[aria-checked='true'] {
    background: var(--nh-line);
    color: var(--nh-text);
    font-weight: 600;
  }

  button:active {
    transform: scale(0.96);
  }

  button:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 1px;
  }

  .fill button {
    flex: 1;
    padding: 0 8px;
  }

  @media (max-width: 599px) {
    .segmented {
      flex: 1;
    }

    button {
      flex: 1;
      padding: 0 8px;
    }
  }
</style>
