import Home from './routes/Home.svelte';
import Settings from './routes/Settings.svelte';
import Reports from './routes/Reports.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import AppSidebar from './components/AppSidebar.svelte';

export const app = {
	appName: 'SampleApp',
	appCode: 'SMP',
	displayName: 'Sample Application',
	dockColor: '#FF6C2E',
	icon: '/assets/icons/production-monitoring-system.svg',
	routes: {
		Home: Home,
		Settings: Settings,
		Reports: Reports
	},
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	menu: {
		routeTitles: {
			Home: 'Dashboard',
			Settings: 'App Settings',
			Reports: 'Data Reports'
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			// This remains unaffected and can be used for dynamic breadcrumbs!
			return paramValue;
		}
	}
};
