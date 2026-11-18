export type MachineJobSourceRoute = 'Dashboard' | 'Machines' | 'Production';

export function machineJobDetailsHash(
	sourceRoute: MachineJobSourceRoute,
	machineId: string,
	jobId: string
): string {
	return `#/PMS/${sourceRoute}/${encodeURIComponent(machineId)}/${encodeURIComponent(jobId)}`;
}

export function resolveMachineJobSourceRoute(hash: string): MachineJobSourceRoute {
	if (hash.includes('/Machines/')) return 'Machines';
	if (hash.includes('/Production/')) return 'Production';
	return 'Dashboard';
}
