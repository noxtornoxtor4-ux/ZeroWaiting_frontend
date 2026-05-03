<script lang="ts">
  import { onDestroy } from 'svelte';
  import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
  import { _ } from 'svelte-i18n';
  import toast from 'svelte-french-toast';
  import { crmQueryApi } from '@/api/endpoints';
  import { getTickets$ByQrCodeValidateV1 } from '@/api/endpoints/tickets';
  import { parseTicketQr, type ParsedTicketQr } from '@/lib/utils/parse-ticket-url';
  import { getErrorMessage } from '@/lib/utils/error';
  import MasterScanModal from './components/MasterScanModal.svelte';
  import SeatRedeemedView from './components/SeatRedeemedView.svelte';

  const STATUS_TO_I18N: Record<string, string> = {
    USED: 'scanner.errors.alreadyUsed',
    CANCELLED: 'scanner.errors.cancelled',
    EXPIRED: 'scanner.errors.expired',
  };

  type Phase =
    | 'scanning'
    | 'masterModal'
    | 'seatRedeemed'
    | 'error';

  let videoEl = $state<HTMLVideoElement | undefined>();
  let phase = $state<Phase>('scanning');
  let errorMsg = $state('');

  let parsed = $state<ParsedTicketQr>(null);

  const masterValidate = crmQueryApi.createGetTicketsMasterByViewerCodeValidateV1(
    () => (parsed?.kind === 'master' ? parsed.token : ''),
    () => ({ query: { enabled: parsed?.kind === 'master' } })
  );
  const masterScan = crmQueryApi.createPatchTicketsMasterByViewerCodeScanV1Mutation();
  const seatScan = crmQueryApi.createPatchTicketsByQrCodeScanV1Mutation();
  const revert = crmQueryApi.createPatchTicketsByQrCodeRevertV1Mutation();

  let redeemedSeat = $state<{ row: number; seat: number; qrCode: string; scannedAt: number } | null>(null);

  const reader = new BrowserMultiFormatReader();
  let controls: IScannerControls | null = null;
  let scanningStarted = false;

  const stopControls = () => { controls?.stop(); controls = null; scanningStarted = false; };

  const instantScanSeat = async (qrCode: string) => {
    try {
      const v = await getTickets$ByQrCodeValidateV1(qrCode);
      if (v.status !== 'VALID') {
        errorMsg = $_(STATUS_TO_I18N[v.status] ?? 'scanner.errors.invalidTicket');
        phase = 'error';
        return;
      }
      await seatScan.mutateAsync({ qrCode });
      redeemedSeat = {
        row: v.seat.row,
        seat: v.seat.seat,
        qrCode,
        scannedAt: Date.now(),
      };
      phase = 'seatRedeemed';
    } catch (e) {
      errorMsg = getErrorMessage(e, $_('scanner.errors.network'), {
        410: $_('scanner.ticketExpired'),
      });
      phase = 'error';
    }
  };

  const startScanning = async () => {
    if (!videoEl || scanningStarted) return;
    scanningStarted = true;
    try {
      let processing = false;
      controls = await reader.decodeFromVideoDevice(undefined, videoEl, async (result) => {
        if (processing || !result) return;
        processing = true;
        try {
          const p = parseTicketQr(result.getText());
          if (!p) {
            errorMsg = $_('scanner.errors.notFound');
            setTimeout(() => { if (phase === 'scanning') errorMsg = ''; }, 2000);
            return;
          }
          parsed = p;
          stopControls();
          if (p.kind === 'master') {
            phase = 'masterModal';
          } else {
            await instantScanSeat(p.token);
          }
        } finally {
          processing = false;
        }
      });
    } catch {
      scanningStarted = false;
      phase = 'error';
      errorMsg = $_('scanner.noCamera');
    }
  };

  const handleMasterSubmit = async (ticketIds: string[]) => {
    if (!parsed || parsed.kind !== 'master') return;
    try {
      const result = await masterScan.mutateAsync({
        viewerCode: parsed.token,
        data: { ticketIds },
      });
      toast.success(
        $_('scanner.partialResult', {
          values: { redeemed: result.redeemed.length, skipped: result.skipped.length },
        }),
      );
      next();
    } catch (e) {
      toast.error(getErrorMessage(e, $_('scanner.errors.network'), {
        410: $_('scanner.ticketExpired'),
      }));
    }
  };

  const handleRevert = async (qrCode: string) => {
    try {
      await revert.mutateAsync({ qrCode });
      toast.success($_('scanner.revertSuccess'));
      next();
    } catch (e) {
      toast.error(getErrorMessage(e, $_('scanner.errors.revertExpired')));
    }
  };

  const handleSeatRevert = async () => {
    if (!redeemedSeat) return;
    await handleRevert(redeemedSeat.qrCode);
  };

  const next = () => {
    parsed = null;
    redeemedSeat = null;
    errorMsg = '';
    phase = 'scanning';
  };

  $effect(() => { if (videoEl && phase === 'scanning') startScanning(); });

  $effect(() => {
    if (phase === 'masterModal' && masterValidate.isError) {
      errorMsg = $_('scanner.errors.notFound');
      phase = 'error';
    }
  });

  onDestroy(() => stopControls());
</script>

<div class="scanner_viewport">
  {#if phase === 'scanning'}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} autoplay playsinline muted></video>
    <p class="scanner_hint">{$_('scanner.scanHint')}</p>
    {#if errorMsg}<p class="scanner_hint warn">{errorMsg}</p>{/if}
  {:else if phase === 'masterModal' && masterValidate.data}
    <MasterScanModal
      seats={masterValidate.data.seats}
      pending={masterScan.isPending}
      onSubmit={handleMasterSubmit}
      onRevert={(ticketId) => {
        const s = masterValidate.data?.seats.find((x) => x.ticketId === ticketId);
        if (s) handleRevert(s.qrCode);
      }}
      onCancel={next}
    />
  {:else if phase === 'masterModal' && masterValidate.isLoading}
    <p class="scanner_hint">…</p>
  {:else if phase === 'seatRedeemed' && redeemedSeat}
    <SeatRedeemedView
      row={redeemedSeat.row}
      seat={redeemedSeat.seat}
      canRevertMs={Math.max(0, 60_000 - (Date.now() - redeemedSeat.scannedAt))}
      pending={revert.isPending}
      onRevert={handleSeatRevert}
      onNext={next}
    />
  {:else}
    <p class="scanner_hint err">{errorMsg}</p>
    <button type="button" class="scanner_btn" onclick={next}>{$_('scanner.next')}</button>
  {/if}
</div>

<style lang="scss">
  .scanner_viewport {
    flex: 1;
    display: flex;
    flex-direction: column;

    video { width: 100%; height: 60vh; object-fit: cover; background: #000; }

    .scanner_hint {
      text-align: center;
      padding: var(--space-4);
      color: var(--muted-fg);

      &.err { color: var(--danger); }
      &.warn { color: var(--warning); }
    }

    .scanner_btn {
      margin: var(--space-3) var(--space-4);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--foreground);
      cursor: pointer;
    }
  }
</style>
