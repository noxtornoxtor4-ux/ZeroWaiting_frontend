import { UserRole } from '@/api/model';

const ROLE_HIERARCHY: Record<string, number> = {
	[UserRole.CUSTOMER]: 0,
	[UserRole.STAFF]: 1,
	[UserRole.MANAGER]: 2,
	[UserRole.ADMIN]: 3,
	[UserRole.SUPER_ADMIN]: 4
};

export const hasMinRole = (
	userRole: string | undefined,
	minRole: string
): boolean => {
	if (!userRole) return false;
	return (
		(ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[minRole] ?? Infinity)
	);
};

export const ROLE_LABELS: Record<string, string> = {
	[UserRole.CUSTOMER]: 'Клиент',
	[UserRole.STAFF]: 'Сотрудник',
	[UserRole.MANAGER]: 'Менеджер',
	[UserRole.ADMIN]: 'Администратор',
	[UserRole.SUPER_ADMIN]: 'Супер-админ'
};
