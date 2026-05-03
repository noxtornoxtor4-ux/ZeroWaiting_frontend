<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Badge from '@/components/ui/Badge.svelte';
  import RevertCountdown from './RevertCountdown.svelte';
  import { TICKET_STATUS_CONFIG } from '@/lib/constants/ticket-status';

  interface Seat {
    ticketId: string;
    qrCode: string;
    row: number;
    seat: number;
    status: string;
    scannedAt: string | null;
    canRevert: boolean;
  }

  interface Props {
    seats: Seat[];
    pending: boolean;
    onSubmit: (ticketIds: string[]) => void;
    onRevert: (ticketId: string) => void;
    onCancel: () => void;
  }

  const { seats, pending, onSubmit, onRevert, onCancel }: Props = $props();

  const initialSelection = () =>
    new Set(seats.filter((s) => s.status === 'VALID').map((s) => s.ticketId));

  let selected = $state<Set<string>>(initialSelection());
  let expired = $state<Set<string>>(new Set());

  const markExpired = (id: string) => {
    const next = new Set(expired);
    next.add(id);
    expired = next;
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  };

  const handleSubmit = () => onSubmit(Array.from(selected));

  const remainingMs = (scannedAt: string) =>
    Math.max(0, 60_000 - (Date.now() - new Date(scannedAt).getTime()));
</script>

<div class="modal_root">
  <h3 class="title">{$_('scanner.markUsedCount', { values: { count: selected.size } })}</h3>

  <ul class="seat_list">
    {#each seats as seat (seat.ticketId)}
      {@const isSelectable = seat.status === 'VALID'}
      {@const cfg = TICKET_STATUS_CONFIG[seat.status] ?? { labelKey: `booking.ticketStatus.${seat.status}`, color: 'var(--muted-fg)' }}
      <li class="seat_row" class:disabled={!isSelectable}>
        <label>
          <input
            type="checkbox"
            disabled={!isSelectable}
            checked={selected.has(seat.ticketId)}
            onchange={() => toggle(seat.ticketId)}
          />
          <span class="seat_label">
            {$_('ticket.rowSeat', { values: { row: seat.row, seats: seat.seat } })}
          </span>
        </label>
        <Badge text={$_(cfg.labelKey)} color={cfg.color} />
        {#if seat.canRevert && seat.scannedAt && !expired.has(seat.ticketId)}
          <button type="button" class="revert_btn" onclick={() => onRevert(seat.ticketId)}>
            {$_('scanner.revertCountdown')}
            (<RevertCountdown durationMs={remainingMs(seat.scannedAt)} onExpire={() => markExpired(seat.ticketId)} />)
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="actions">
    <button type="button" class="secondary" onclick={onCancel}>{$_('scanner.next')}</button>
    <button type="button" class="primary" disabled={pending || selected.size === 0} onclick={handleSubmit}>
      {$_('scanner.markUsedCount', { values: { count: selected.size } })}
    </button>
  </div>
</div>

<style lang="scss">
  .modal_root {
    background: #12121c;
    border-radius: var(--radius-xl);
    padding: var(--space-5);
    margin: var(--space-4);
    color: var(--foreground);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);

    .title { font-size: var(--text-lg); margin: 0; }

    .seat_list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);

      .seat_row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: rgba(255,255,255,0.03);

        &.disabled { opacity: 0.6; }

        label {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
          cursor: pointer;
        }
      }

      .revert_btn {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--warning);
        border-radius: var(--radius-sm);
        padding: 4px 8px;
        font-size: var(--text-xs);
      }
    }

    .actions {
      display: flex;
      gap: var(--space-3);

      .primary, .secondary {
        flex: 1;
        padding: var(--space-3);
        border-radius: var(--radius-md);
        font-weight: var(--weight-semibold);
        cursor: pointer;
        border: 0;
      }
      .primary { background: var(--primary); color: #fff; &:disabled { opacity: 0.5; } }
      .secondary { background: transparent; border: 1px solid var(--border-color); color: inherit; }
    }
  }
</style>
