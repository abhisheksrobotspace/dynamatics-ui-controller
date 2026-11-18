import Plants from './routes/Plants.svelte';
import Locations from './routes/Locations.svelte';
import TransferTimes from './routes/TransferTimes.svelte';
import Machines from './routes/Machines.svelte';
import MachinesConfig from './routes/MachinesConfig.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';

export const app = {
	appName: 'AssetManager',
	appCode: 'AM',
	displayName: 'Asset Manager',
	dockColor: '#14B8A6',
	icon: '/assets/icons/asset-manager.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	routes: {
		Home: Plants,
		Plants: Plants,
		Locations: Locations,
		TransferTimes: TransferTimes,
		Machines: Machines,
		MachinesConfig: MachinesConfig
	},
	menu: {
		routeTitles: {
			Home: 'Plants',
			Plants: 'Plants',
			Locations: 'Locations',
			TransferTimes: 'Transfer Time Configurations',
			Machines: 'Machines',
			MachinesConfig: 'Machines Config'
		},
		resolveParamName: (_paramName: string, paramValue: string) => paramValue
	}
};
