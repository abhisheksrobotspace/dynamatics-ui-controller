import Lockscreen from '../Lockscreen.ioware.svelte';
import TaskBarAccountIoware from '../TaskBarAccount.ioware.svelte';
import AppLauncherIoware from '../AppLauncher.ioware.svelte';
import { House, Info, ToggleRight, Wifi } from '@lucide/svelte';
import TopBarIoware from '../TopBar.ioware.svelte';
import { LOGOUT_CONFIRM } from '../HmiConfirmDialog.svelte';
import MachineIdleOverlay from '../machine-idle/MachineIdleOverlay.svelte';
import InterlockOverlay from '../interlock/InterlockOverlay.svelte';
import { bindDeviceMqttEvents } from '$lib/device';
import {
	bindMachineIdleMqttEvents,
	onOperatorLoggedInForIdle,
	onOperatorLoggedOutForIdle
} from '../machine-idle/machine-idle-store.svelte';
import { bindInterlockMqttEvents } from '../interlock/interlock-store.svelte';
import { launchAutoStartApps, switchOperator, user, type AppDefinition } from '../index.svelte';
import {
	bindOperatorSessionEndedMqtt,
	endOperatorSession,
	runBeforeOperatorLogout
} from '../session.js';
import { hydrateOsMachineSettings } from '../boot-settings.js';
import { bindMachineReadiness } from '../app-visibility.svelte.js';
import { apps } from '../../../routes/osConfig.ioware';
import type { OsFlavor } from './types';

export { apps };

const allApps = apps as Record<string, AppDefinition>;

export const flavor: OsFlavor = {
	id: 'ioware',
	layout: 'overlay',
	Lockscreen,
	SetPassword: null,
	Overlays: [MachineIdleOverlay, InterlockOverlay],
	TopBar: TopBarIoware,
	taskBar: {
		logoMinimizes: false,
		accountLabel: 'Switch Operator',
		accountSubtitle: 'ioWare',
		userFallbackName: 'Operator',
		triggerAvatarSize: 'md',
		dockClass: 'border-r-2 border-[#3E454D] bg-[#212529]',
		iconTiles: true,
		// PMS is the home screen on the HMI: always on the dock; other apps open from the logo.
		dockPinned: ['PMS'],
		Launcher: AppLauncherIoware,
		dockItems: {
			PMS: { icon: House, label: 'Home' },
			WiFi: { icon: Wifi, label: 'Wi‑Fi' },
			IO: { icon: ToggleRight, label: 'I/O' },
			Device: { icon: Info, label: 'About' }
		},
		clockTextClass:
			"flex h-[23px] items-center justify-center whitespace-nowrap font-['Space_Grotesk',sans-serif] text-lg leading-[23px] font-bold text-white",
		accountConfirm: { ...LOGOUT_CONFIRM, hmi: true },
		async onAccountAction() {
			await runBeforeOperatorLogout();
			switchOperator.isClicked = true;
			await endOperatorSession();
			onOperatorLoggedOutForIdle();
		},
		AccountMenu: TaskBarAccountIoware
	},
	onShellMount() {
		// Start settings hydrate first (non-blocking); bind overlays on static fallback.
		void hydrateOsMachineSettings();
		const unbindReadiness = bindMachineReadiness({
			onRisingEdge() {
				// Rising edge only — periodic machineSettings echoes must not re-focus apps.
				// Use full catalog; launchAutoStartApps + isAppVisible gate requiresAssetClass.
				if (user.isLoggedIn) {
					launchAutoStartApps(allApps, { isIoware: true });
				}
			}
		});
		const unbindNetworkMqtt = bindDeviceMqttEvents();
		const unbindMachineIdleMqtt = bindMachineIdleMqttEvents();
		const unbindInterlockMqtt = bindInterlockMqttEvents();
		const unbindSessionEndedMqtt = bindOperatorSessionEndedMqtt(() => {
			switchOperator.isClicked = true;
			onOperatorLoggedOutForIdle();
		});

		return () => {
			unbindReadiness?.();
			unbindNetworkMqtt?.();
			unbindMachineIdleMqtt?.();
			unbindInterlockMqtt?.();
			unbindSessionEndedMqtt?.();
		};
	},
	onOperatorLogin(data, { isFirstLogin }) {
		user.isLoggedIn = true;
		user.name = data.user?.name ?? 'Operator';
		user.id = data.user?.id;
		user.code = data.user?.code;
		switchOperator.isClicked = false;
		onOperatorLoggedInForIdle();
		if (isFirstLogin) {
			// Skips requiresAssetClass apps until machineReadiness.hasAssetClass.
			launchAutoStartApps(allApps, { isIoware: true });
		}
	}
};
