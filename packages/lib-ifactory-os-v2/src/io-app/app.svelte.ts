import Home from './routes/Home.svelte';

export const ioApp = {
	appName: 'IO',
	appCode: 'IO',
	displayName: 'IO',
	dockColor: '#FEC501',
	icon: '/assets/icons/io.svg',
	showInLauncher: true,
	autoLaunchOnLogin: false,
	windowControls: {
		close: true,
		minimize: true,
		draggable: false,
		/** The page has its own HMI title; the OS top bar sits above. */
		menuBar: false
	},
	data: {},
	menu: {},
	routes: {
		Home
	},
	strings: {
		en: {
			appName: 'IO'
		}
	}
};
