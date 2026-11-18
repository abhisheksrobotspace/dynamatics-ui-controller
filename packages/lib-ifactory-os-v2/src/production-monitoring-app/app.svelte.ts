import Dashboard from './routes/Dashboard.svelte';
import Machines from './routes/Machines.svelte';
import Production from './routes/Production.svelte';
import Jobs from './routes/Jobs.svelte';
import HMIJobs from './routes/HMIJobs.svelte';
import Tickets from './routes/Tickets.svelte';
import Operators from './routes/Operators.svelte';
import SearchByMir from './routes/SearchByMir.svelte';
import SearchByMarking from './routes/SearchByMarking.svelte';
import MachineDetails from './routes/MachineDetails.svelte';
import MachineJobDetails from './routes/MachineJobDetails.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import {
	getMachineLabel,
	ensureMachineLabel,
	ensureJobLabel,
	getJobLabel
} from './lib/machines.api.js';

export const app = {
	appName: 'PMS',
	appCode: 'PMS',
	displayName: 'PMS',
	dockColor: '#FF6C2E',
	icon: '/assets/icons/production-monitoring-system.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	routes: {
		Home: Dashboard,
		Dashboard,
		'Dashboard/:machineId': MachineDetails,
		'Dashboard/:machineId/:jobId': MachineJobDetails,
		Machines,
		'Machines/:machineId': MachineDetails,
		'Machines/:machineId/:jobId': MachineJobDetails,
		Production,
		'Production/:machineId': MachineDetails,
		'Production/:machineId/:jobId': MachineJobDetails,
		Jobs,
		HMIJobs,
		Tickets,
		Operators,
		SearchByMir,
		SearchByMarking
	},
	menu: {
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			const machineId = params.machineId?.trim();
			if (
				machineId &&
				(pattern === 'Dashboard/:machineId' ||
					pattern === 'Machines/:machineId' ||
					pattern === 'Production/:machineId')
			) {
				await ensureMachineLabel(machineId, signal);
			}
			if (
				machineId &&
				(pattern === 'Dashboard/:machineId/:jobId' ||
					pattern === 'Machines/:machineId/:jobId' ||
					pattern === 'Production/:machineId/:jobId')
			) {
				await ensureMachineLabel(machineId, signal);
			}
			const jobId = params.jobId?.trim();
			if (
				jobId &&
				(pattern === 'Dashboard/:machineId/:jobId' ||
					pattern === 'Machines/:machineId/:jobId' ||
					pattern === 'Production/:machineId/:jobId')
			) {
				await ensureJobLabel(decodeURIComponent(jobId), signal);
			}
		},
		routeTitles: {
			Home: 'Dashboard',
			Dashboard: 'Dashboard',
			'Dashboard/:machineId': 'Machine Details',
			'Dashboard/:machineId/:jobId': 'Job Details',
			Machines: 'Machines',
			'Machines/:machineId': 'Machine Details',
			'Machines/:machineId/:jobId': 'Job Details',
			Production: 'Production',
			'Production/:machineId': 'Machine Details',
			'Production/:machineId/:jobId': 'Job Details',
			Jobs: 'Jobs',
			HMIJobs: 'HMI Jobs',
			Tickets: 'Tickets',
			Operators: 'Operators',
			SearchByMir: 'Search by MIR',
			SearchByMarking: 'Search by Marking'
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			if (paramName === 'machineId') {
				return getMachineLabel(paramValue);
			}
			if (paramName === 'jobId') {
				return getJobLabel(decodeURIComponent(paramValue));
			}
			return paramValue;
		}
	}
};
