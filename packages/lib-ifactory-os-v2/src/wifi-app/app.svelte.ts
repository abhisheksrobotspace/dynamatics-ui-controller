import App from './routes/App.svelte';

export const wifiApp = {
	appName: 'WiFi',
	appCode: 'WIFI',
	displayName: 'Wi-Fi',
	dockColor: '#3B82F6',
	icon: '/assets/icons/wifi-app.svg',
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
			Home: 'Wi-Fi'
		}
	},
	strings: {
		en: {
			appName: 'Wi-Fi'
		}
	}
};
