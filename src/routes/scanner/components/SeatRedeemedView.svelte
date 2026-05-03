<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '@iconify/svelte';
  import RevertCountdown from './RevertCountdown.svelte';

  interface Props {
    row: number;
    seat: number;
    canRevertMs: number;
    pending: boolean;
    onRevert: () => void;
    onNext: () => void;
  }

  const { row, seat, canRevertMs, pending, onRevert, onNext }: Props = $props();

  let expired = $state(false);
  const revertVisible = $derived(!expired && canRevertMs > 0);
</script>

<div class="success">
  <Icon icon="lucide:check-circle-2" width={64} />
  <p class="seat_label">{$_('ticket.rowSeat', { values: { row, seats: seat } })}</p>
  <p class="ok_msg">{$_('scanner.scanSuccess')}</p>

  <div class="actions">
    {#if revertVisible}
      <button type="button" class="revert" disabled={pending} onclick={onRevert}>
        {$_('scanner.revertCountdown')}
        (<RevertCountdown durationMs={canRevertMs} onExpire={() => (expired = true)} />)
      </button>
    {/if}
    <button type="button" class="next" onclick={onNext}>{$_('scanner.next')}</button>
  </div>
</div>

<style lang="scss">
  .success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6);
    color: var(--success);
    text-align: center;

    .seat_label { font-size: var(--text-xl); font-weight: var(--weight-bold); margin: 0; color: var(--foreground); }
    .ok_msg { margin: 0; font-size: var(--text-base); }

    .actions { display: flex; gap: var(--space-3); margin-top: var(--space-3); }

    .revert, .next {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: var(--weight-semibold);
    }
    .revert { background: transparent; border: 1px solid var(--warning); color: var(--warning); }
    .next { background: transparent; border: 1px solid var(--border-color); color: var(--foreground); }
  }
</style>
