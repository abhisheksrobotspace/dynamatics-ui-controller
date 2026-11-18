import type { Component } from 'svelte';
import type { AppDefinition } from '../index.svelte';

export type OsFlavorId = 'cloud' | 'ioware';

/** How lockscreen relates to the desktop. */
export type OsFlavorLayout = 'gate' | 'overlay';

export type OsFlavorLoginPayload = {
	user?: {
		id?: string;
		name?: string;
		/** Operator login code (ioware top bar). */
		code?: string;
		email?: string;
		image?: string;
		mustChangePassword?: boolean;
	};
	password?: string;
};

export type OsTaskBarAccountConfirm = {
	title: string;
	confirmLabel: string;
	/** Second line under the title (HMI dialog only). */
	message?: string;
	/** Use the HMI confirm dialog (flat keys) instead of the web one. */
	hmi?: boolean;
};

export type OsTaskBarConfig = {
	logoMinimizes?: boolean; // default true
	accountLabel?: string; // default 'Log Off'
	accountSubtitle?: string; // default user.activeFactoryName || 'No Plant Selected'
	userFallbackName?: string; // default 'User'
	triggerAvatarSize?: 'md' | 'lg'; // default 'md'
	clockTextClass?: string; // optional override for clock span classes
	accountConfirm?: OsTaskBarAccountConfirm | null;
	onAccountAction?: () => void | Promise<void>;
	/** Optional tray above avatar (idle/interlock chips). Only ioware sets this. */
	Tray?: Component | null;
	/** Dock container classes override (ioware HMI dock colours). */
	dockClass?: string;
	/** App icons always on a white tile, never swapped for the abbreviation (ioware HMI). */
	iconTiles?: boolean;
	/**
	 * HMI dock keys by `appName` (icon + short label under the key). Apps listed here render as
	 * keycaps; others keep the icon tile.
	 */
	dockItems?: Record<
		string,
		{ icon: Component<{ class?: string; strokeWidth?: number }>; label: string }
	>;
	/**
	 * HMI: the dock lists only these `appName`s plus apps that are open; the logo opens
	 * `Launcher` with every app. Unset keeps the full dock.
	 */
	dockPinned?: string[];
	Launcher?: Component<{
		open?: boolean;
		appsInstalled?: Record<string, AppDefinition>;
		dockItems?: OsTaskBarConfig['dockItems'];
	}> | null;
	/** Replaces the avatar dropdown (ioware HMI); the clock then sits above it. */
	AccountMenu?: Component<{ name: string; onLogout: () => void }> | null;
};

export type OsFlavor = {
	id: OsFlavorId;
	/** `gate`: lockscreen/session replaces desktop. `overlay`: desktop under lockscreen. */
	layout: OsFlavorLayout;
	Lockscreen: Component<Record<string, unknown>>;
	SetPassword?: Component<{
		currentPassword?: string;
		oncomplete?: () => void | Promise<void>;
	}> | null;
	Overlays?: Component[];
	taskBar?: OsTaskBarConfig;
	/** Bar across the top of the desktop, right of the dock. Only ioware sets this. */
	TopBar?: Component<{ appsInstalled?: Record<string, AppDefinition> }> | null;
	/** Flavor-specific shell mount (e.g. MQTT binds). Return cleanup. */
	onShellMount?: () => (() => void) | void;
	/** Flavor-specific login side effects after user.isLoggedIn is set by the shell when needed. */
	onOperatorLogin?: (
		data: OsFlavorLoginPayload,
		ctx: { accessibleApps: Record<string, AppDefinition>; isFirstLogin: boolean }
	) => void;
};
