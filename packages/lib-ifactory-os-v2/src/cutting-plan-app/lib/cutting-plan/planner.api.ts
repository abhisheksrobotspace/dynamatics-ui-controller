import { PLANNER_API_BASE } from './constants';
import type { PlanRequest, PlanResponse } from './types';

function formatPlannerError(data: Record<string, unknown>, status: number): string {
	if (typeof data.error === 'string') return data.error;
	if (typeof data.detail === 'string') return data.detail;
	if (Array.isArray(data.detail)) {
		return data.detail
			.map((item) =>
				typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item)
			)
			.join(', ');
	}
	return `Planner request failed (${status})`;
}

export async function plannerFetch<T = PlanResponse>(path: string, init?: RequestInit): Promise<T> {
	if (!PLANNER_API_BASE && import.meta.env.PROD) {
		throw new Error(
			'Planner API is not configured. Set VITE_PLANNER_API_BASE for production builds.'
		);
	}

	let res: Response;
	try {
		res = await fetch(`${PLANNER_API_BASE}${path}`, init);
	} catch {
		throw new Error(
			'Cannot reach the cutting plan solver. Ensure it is running on port 8000 (local dev uses the Vite proxy) or set VITE_PLANNER_API_BASE.'
		);
	}

	const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	if (!res.ok) throw new Error(formatPlannerError(data, res.status));
	if (typeof data.error === 'string') throw new Error(data.error);
	return data as T;
}

export async function submitCuttingPlan(payload: PlanRequest): Promise<PlanResponse> {
	return plannerFetch<PlanResponse>('/api/plan', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
}
