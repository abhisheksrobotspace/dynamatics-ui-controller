import App from './routes/App.svelte';

export const deviceApp = {
	appName: 'Device',
	appCode: 'DEVICE',
	displayName: 'About Device',
	dockColor: '#94A3B8',
	icon: '/assets/icons/device.svg',
	showInLauncher: true,
	autoLaunchOnLogin: false,
	windowControls: {
		close: true,
		minimize: true,
		draggable: false,
		/** The page has its own HMI title; the OS top bar sits above. */
		menuBar: false
	},
	routes: {
		Home: App
	},
	menu: {
		routeTitles: {
			Home: 'About Device'
		}
	},
	strings: {
		en: {
			appName: 'About Device'
		}
	}
};
