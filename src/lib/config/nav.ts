import { UserRole } from '@/api/model';

export interface NavItem {
	label: string;
	href: string;
	icon: string;
	minRole: string;
}

export const adminNavItems: NavItem[] = [
	{
		label: 'Дашборд',
		href: '/admin/dashboard',
		icon: 'lucide:layout-dashboard',
		minRole: UserRole.MANAGER
	},
	{
		label: 'Фильмы',
		href: '/admin/movies',
		icon: 'lucide:clapperboard',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Сеансы',
		href: '/admin/screenings',
		icon: 'lucide:calendar-clock',
		minRole: UserRole.MANAGER
	},
	{
		label: 'Бронирования',
		href: '/admin/bookings',
		icon: 'lucide:ticket',
		minRole: UserRole.MANAGER
	},
	{
		label: 'Кинотеатры',
		href: '/admin/cinemas',
		icon: 'lucide:building-2',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Филиалы',
		href: '/admin/branches',
		icon: 'lucide:store',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Залы',
		href: '/admin/halls',
		icon: 'lucide:projector',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Еда',
		href: '/admin/food-items',
		icon: 'lucide:utensils',
		minRole: UserRole.MANAGER
	},
	{
		label: 'Промокоды',
		href: '/admin/promo-codes',
		icon: 'lucide:ticket-percent',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Анонсы',
		href: '/admin/announcements',
		icon: 'lucide:megaphone',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Акции',
		href: '/admin/promotions',
		icon: 'lucide:badge-percent',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Групповые заявки',
		href: '/admin/group-bookings',
		icon: 'lucide:users',
		minRole: UserRole.MANAGER
	},
	{
		label: 'Аналитика',
		href: '/admin/analytics',
		icon: 'lucide:bar-chart-3',
		minRole: UserRole.MANAGER
	},
	{
		label: 'Сотрудники',
		href: '/admin/staff',
		icon: 'lucide:id-card',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Аудит',
		href: '/admin/audit-log',
		icon: 'lucide:history',
		minRole: UserRole.ADMIN
	},
	{
		label: 'Пользователи',
		href: '/admin/users',
		icon: 'lucide:shield-check',
		minRole: UserRole.SUPER_ADMIN
	}
];
