/** APS screens are hosted under Shop Floor Planning (not the retired APS dock app). */
export const APS_HOST_APP = 'ShopFloorPlanning';

/** Route prefix for APS flows inside SFP. `planId` param = `aps_schedule_requests.request_id`. */
export const APS_ROUTE_PREFIX = 'Aps';

export function apsPlanBasePath(planId: string): string {
	return `#/${APS_HOST_APP}/${APS_ROUTE_PREFIX}/${encodeURIComponent(planId)}`;
}
