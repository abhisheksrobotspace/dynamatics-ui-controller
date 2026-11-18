import App from './routes/App.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import { SUPPORTED_ASSET_CLASSES } from './lib/line-from-class';

export const pmsApp = {
	appName: 'PMS',
	appCode: 'PMS',
	displayName: 'PMS',
	dockColor: '#FF6C2E',
	icon: '/assets/icons/pms.svg',
	showInLauncher: true,
	autoLaunchOnLogin: true,
	/** Dock + auto-launch only for classes this build can open (ioware). */
	visibility: 'requiresAssetClass' as const,
	supportedAssetClasses: SUPPORTED_ASSET_CLASSES,
	windowControls: {
		close: false,
		minimize: false,
		draggable: false,
		menuBar: false
	},
	topbarComponent: TopbarControls,
	routes: {
		Home: App
	},
	menu: {
		routeTitles: {
			Home: 'PMS'
		}
	},
	strings: {
		en: {
			appName: 'PMS'
		}
	}
};

/** @deprecated Prefer `pmsApp` */
export const app = pmsApp;
