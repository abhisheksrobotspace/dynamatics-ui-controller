/** Host-app helpers for cutting-plan hashes when CP is hosted outside Project Management. */

const RETURN_HASH_KEY = 'ifactory.cuttingPlan.returnHash';
const ASSIGN_LOCK_REPLAN_ACCEPT_KEY = 'ifactory.cuttingPlan.assignLockReplanAccept';

export function hostAppFromLocation(fallback = 'ProjectManagement'): string {
	if (typeof window === 'undefined') return fallback;
	const match = /^#\/([^/]+)/.exec(window.location.hash || '');
	return match?.[1] || fallback;
}

/** Remember Assign & Lock (or other) hash so Cancel can leave the CP wizard. */
export function stashCuttingPlanReturnHash(hash = window.location.hash): void {
	try {
		sessionStorage.setItem(RETURN_HASH_KEY, hash);
	} catch {
		// private mode / quota
	}
}

export function peekCuttingPlanReturnHash(): string | null {
	try {
		return sessionStorage.getItem(RETURN_HASH_KEY);
	} catch {
		return null;
	}
}

/** Context so Results can re-pin DS lines and return to Assign & Lock / Stock Assignment Lock. */
export type AssignLockReplanAccept = {
	projectId: string;
	bomId: string;
	returnHash: string;
	deliveryScheduleLineId?: string;
};

export function stashAssignLockReplanAccept(payload: AssignLockReplanAccept): void {
	try {
		sessionStorage.setItem(ASSIGN_LOCK_REPLAN_ACCEPT_KEY, JSON.stringify(payload));
	} catch {
		// private mode / quota
	}
}

export function peekAssignLockReplanAccept(): AssignLockReplanAccept | null {
	try {
		const raw = sessionStorage.getItem(ASSIGN_LOCK_REPLAN_ACCEPT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as AssignLockReplanAccept;
		if (
			typeof parsed?.projectId !== 'string' ||
			typeof parsed?.bomId !== 'string' ||
			typeof parsed?.returnHash !== 'string'
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function clearAssignLockReplanAccept(): void {
	try {
		sessionStorage.removeItem(ASSIGN_LOCK_REPLAN_ACCEPT_KEY);
	} catch {
		// private mode / quota
	}
}
