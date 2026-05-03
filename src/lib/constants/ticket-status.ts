import { TicketStatus } from '@/api/model';

export const TICKET_STATUS_CONFIG: Record<
	string,
	{ labelKey: string; color: string }
> = {
	[TicketStatus.VALID]: {
		labelKey: 'booking.ticketStatus.VALID',
		color: 'var(--success)'
	},
	[TicketStatus.USED]: {
		labelKey: 'booking.ticketStatus.USED',
		color: 'var(--muted-fg)'
	},
	[TicketStatus.CANCELLED]: {
		labelKey: 'booking.ticketStatus.CANCELLED',
		color: 'var(--danger)'
	},
	[TicketStatus.EXPIRED]: {
		labelKey: 'booking.ticketStatus.EXPIRED',
		color: 'var(--muted-fg)'
	}
};
