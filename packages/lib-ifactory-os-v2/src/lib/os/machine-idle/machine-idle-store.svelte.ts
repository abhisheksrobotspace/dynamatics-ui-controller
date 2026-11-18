import { globalMqtt } from '../lib/custom-scripts/mqtt.js';
import { ensureSelectedAssetId, withAssetId } from '../asset-context.js';
import { STOPPAGE_REASONS, type StoppageReason } from '$lib/stoppage-reasons';
import {
	findCatalogReasonByCode,
	findCatalogReasonById,
	getSelectableCatalogReasons,
	loadReasonsCatalog,
	reasonsCatalog
} from '../reasons-catalog.svelte.js';
import { reasonNumber } from '../../../pms-app/lib/reason-categories.js';

export const MACHINE_STATE = {
	IDLE: 1,
	SETUP: 2,
	PRODUCTION: 3,
	DOWNTIME: 4,
	MAINTENANCE: 5,
	SHUTDOWN: 6
} as const;

/** AI-OS synthetic / auto-alert ids used when no catalog reason is selected yet. */
export const SYNTHETIC_ALERT = {
	NO_JOB: 102,
	NO_LOGIN: 103,
	/**
	 * Catalogue reason 7 "No Operator" — the auto-alert reason, NOT an HMI-only alarm like 102/103: the controller holds it
	 * on the stoppage until production, a job or another pick, so a login or logout does not clear it here either.
	 */
	NO_OPERATOR: 7
} as const;

const OVERLAY_ALERT_TOPIC = '/iow/overlayAlert';
/** Idle reason picker opened — controller starts the stoppage/ticket at this instant. */
const OVERLAY_OPENED_TOPIC = '/iow/overlayOpened';
const CLOSE_OVERLAY_TICKET_TOPIC = '/iow/closeTicket';
const MACHINE_AVAILABILITY_TOPIC = '/rt/d2c';
const PRODUCTION_NO_OPERATOR_TOPIC = '/iow/productionWithNoOperator';
const PRODUCTION_NO_JOB_TOPIC = '/iow/productionWithNoJob';
const PRODUCTION_ALARM_CLEARED_TOPIC = '/iow/productionAlarmCleared';
/** Legacy periodic availability (pre-PMS). Still accepted so older controllers keep working. */
const LEGACY_AVAILABILITY_EID = 109;
/** Transition + confirm — what jsl-ioware-pro-controller emits now. */
const STATE_CHANGED_EID = 7001;
const STATE_CONFIRM_EID = 7003;
const STATE_REASON_RENAMED_EID = 7004;
const DURATION_TOLERANCE_MS = 5_000;
const EXPECTED_AVAILABILITY_DURATION_MS = 60_000;
/** Same default as the controller (`autoAlertSelectTimeoutMs` / 5 min). */
const DEFAULT_AUTO_ALERT_TIMEOUT_MS = 300_000;
/** Fallback when settings omit `defaultReasons.unattended` / `noOperator`. */
const DEFAULT_AUTO_ALERT_REASON_CODE = 'no_operator';
const MACHINE_SETTINGS_TOPIC = '/iow/machineSettings';

export type OverlayAlert = {
	id: number | '';
	label: string;
};

export const machineStoppedOverlay = $state({
	isOpen: false,
	/**
	 * When false, availability ticks must not force the overlay open again
	 * (operator already dismissed after selecting a reason — reopen via TaskBar).
	 */
	canOpen: true,
	/** When true, show reason picker instead of idle summary. */
	pickingReason: false,
	/**
	 * Production-with-no-job / no-operator alarm: reason is fixed — hide Change Reason.
	 * Cleared on `/iow/productionAlarmCleared`.
	 */
	reasonLocked: false,
	productionAlert: false
});

export const selectedOverlayAlert = $state<OverlayAlert>({
	id: '',
	label: ''
});

/** PMS sets this while a bar is running so availability does not force Idle over Job Running. */
export const machineIdleJobContext = $state({
	hasActiveJob: false
});

export const machineIdleStore = $state({
	idleSeconds: 0,
	/** Last `machineState` from availability events ({@link MACHINE_STATE}); null until one arrives. */
	machineState: null as number | null,
	autoAlertTimeoutMs: DEFAULT_AUTO_ALERT_TIMEOUT_MS,
	/** Applied when the operator does not pick in time (idle overlay). */
	autoAlertReasonCode: DEFAULT_AUTO_ALERT_REASON_CODE
});

let idleTimer: ReturnType<typeof setInterval> | null = null;
let autoAlertTimer: ReturnType<typeof setTimeout> | null = null;
let mqttBound = false;
let mqttRefCount = 0;
let onMqttEvent: ((topic: string, data: unknown) => void) | null = null;
let prevMachineState: number | null = null;
let skipNextAvailabilityUpdate = false;
/**
 * After job → summary: ignore the immediate `7001` from detach/enterState and only
 * open Machine Idle on the next `7003` confirm (or legacy periodic availability).
 */
let deferIdleOverlayUntilConfirm = false;
/** When the open reason picker started: the auto-pick fires `autoAlertTimeoutMs` after this, however often it is re-armed. */
let autoAlertStartedAt: number | null = null;
/** `enteredAt` of the current job-less production spell, for the Production Alert timer. */
let productionEnteredAt: unknown = null;

function clearIdleTimer() {
	if (idleTimer) {
		clearInterval(idleTimer);
		idleTimer = null;
	}
}

function ensureIdleTimer() {
	if (idleTimer) return;
	idleTimer = setInterval(() => {
		machineIdleStore.idleSeconds += 1;
	}, 1000);
}

function startIdleTimer(initialSeconds = 0) {
	clearIdleTimer();
	machineIdleStore.idleSeconds = Math.max(0, Math.floor(initialSeconds));
	ensureIdleTimer();
}

/** Ends the auto-pick for the current picker: its timer and its start time. */
function clearAutoAlertTimer() {
	cancelAutoAlertTimeout();
	autoAlertStartedAt = null;
}

function cancelAutoAlertTimeout() {
	if (autoAlertTimer) {
		clearTimeout(autoAlertTimer);
		autoAlertTimer = null;
	}
}

export function formatIdleHmsParts(totalSeconds: number) {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return {
		hours: String(hours).padStart(2, '0'),
		minutes: String(minutes).padStart(2, '0'),
		seconds: String(seconds).padStart(2, '0')
	};
}

/** Compact timer for TaskBar / Lockscreen chip. */
export function formatIdleHms(totalSeconds: number): string {
	const { hours, minutes, seconds } = formatIdleHmsParts(totalSeconds);
	return `${hours}:${minutes}:${seconds}`;
}

/** True when a reason is active but the full overlay is dismissed — show TaskBar / Lockscreen chip. */
export function hasIdleTaskBarChip(): boolean {
	return Boolean(
		selectedOverlayAlert.id !== '' &&
		!machineStoppedOverlay.isOpen &&
		!machineIdleJobContext.hasActiveJob
	);
}

export function setMachineIdleAutoAlertTimeoutMs(ms: number | null | undefined) {
	const n = typeof ms === 'number' ? ms : typeof ms === 'string' ? Number(ms) : NaN;
	if (Number.isFinite(n) && n >= 0) {
		machineIdleStore.autoAlertTimeoutMs = n;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** KV slice uses `_shared`; controller `/iow/machineSettings` echo is flat. */
function autoAlertTimeoutFromSettings(settings: Record<string, unknown>): unknown {
	const shared = isRecord(settings._shared) ? settings._shared : null;
	return shared?.autoAlertSelectTimeoutMs ?? settings.autoAlertSelectTimeoutMs;
}

function defaultReasonsFromSettings(settings: Record<string, unknown>): {
	unattended?: unknown;
	noOperator?: unknown;
} {
	const shared = isRecord(settings._shared) ? settings._shared : null;
	const fromShared = isRecord(shared?.defaultReasons) ? shared.defaultReasons : null;
	const fromTop = isRecord(settings.defaultReasons) ? settings.defaultReasons : null;
	return (fromShared ?? fromTop ?? {}) as {
		unattended?: unknown;
		noOperator?: unknown;
	};
}

/**
 * Arm the auto-pick for `autoAlertTimeoutMs` after the picker opened. Re-arming (a settings
 * echo, another availability tick) only re-applies the same deadline; it never restarts it.
 */
function armIdleAutoAlertTimer() {
	cancelAutoAlertTimeout();
	autoAlertStartedAt ??= Date.now();
	const remainingMs = Math.max(
		0,
		autoAlertStartedAt + machineIdleStore.autoAlertTimeoutMs - Date.now()
	);
	autoAlertTimer = setTimeout(() => {
		if (machineIdleJobContext.hasActiveJob) return;
		if (selectedOverlayAlert.id) return;
		const reason = resolveReasonByCode(machineIdleStore.autoAlertReasonCode);
		if (!reason) return;
		publishOverlayAlert(reason);
	}, remainingMs);
}

function shouldRearmIdleAutoAlert(): boolean {
	return (
		machineStoppedOverlay.isOpen &&
		machineStoppedOverlay.pickingReason &&
		!selectedOverlayAlert.id &&
		!machineIdleJobContext.hasActiveJob
	);
}

/**
 * Read `autoAlertSelectTimeoutMs` and the auto-alert reason from
 * `defaultReasons.unattended` → `noOperator` → `no_operator` (same order as the controller).
 *
 * If the idle picker is already open with no selection, re-arm the timer so a late
 * settings load does not leave a stale timeout running.
 */
export async function syncIdleAutoAlertTimeoutFromSettings(
	opts: { rearm?: boolean } = {}
): Promise<void> {
	const rearm = opts.rearm !== false;
	try {
		const settings = await globalMqtt.get('machineSettings');
		if (!settings || typeof settings !== 'object' || 'error' in settings) return;
		const record = settings as Record<string, unknown>;

		setMachineIdleAutoAlertTimeoutMs(autoAlertTimeoutFromSettings(record));

		const defaults = defaultReasonsFromSettings(record);
		const unattended =
			typeof defaults.unattended === 'string' ? defaults.unattended.trim().toLowerCase() : '';
		const noOperator =
			typeof defaults.noOperator === 'string' ? defaults.noOperator.trim().toLowerCase() : '';
		machineIdleStore.autoAlertReasonCode =
			unattended || noOperator || DEFAULT_AUTO_ALERT_REASON_CODE;

		if (rearm && shouldRearmIdleAutoAlert()) {
			armIdleAutoAlertTimer();
		}
	} catch (error) {
		console.error('Failed to sync idle auto-alert defaults from machineSettings:', error);
	}
}

export function setMachineIdleHasActiveJob(
	hasActiveJob: boolean,
	opts?: { deferOverlayUntilNextHeartbeat?: boolean }
) {
	machineIdleJobContext.hasActiveJob = hasActiveJob;
	if (hasActiveJob) {
		deferIdleOverlayUntilConfirm = false;
		clearSelectedIdleAlert();
		closeMachineIdleOverlay({ allowReopen: true });
		return;
	}
	if (opts?.deferOverlayUntilNextHeartbeat) {
		deferIdleOverlayUntilConfirm = true;
	}
}

function clearSelectedIdleAlert() {
	selectedOverlayAlert.id = '';
	selectedOverlayAlert.label = '';
	clearIdleTimer();
	machineIdleStore.idleSeconds = 0;
}

function openMachineIdleOverlay(opts?: {
	pickingReason?: boolean;
	resetTimer?: boolean;
	idleSeconds?: number;
}) {
	machineStoppedOverlay.isOpen = true;
	machineStoppedOverlay.pickingReason = opts?.pickingReason ?? !selectedOverlayAlert.id;
	const seeded =
		typeof opts?.idleSeconds === 'number' && Number.isFinite(opts.idleSeconds)
			? Math.max(0, Math.floor(opts.idleSeconds))
			: null;
	if (opts?.resetTimer !== false) {
		startIdleTimer(seeded ?? 0);
	} else if (seeded != null) {
		startIdleTimer(seeded);
	} else {
		ensureIdleTimer();
	}
}

/** Full close + clear (job started / idle condition cleared). */
export function closeMachineIdleOverlay(opts?: { allowReopen?: boolean }) {
	machineStoppedOverlay.isOpen = false;
	machineStoppedOverlay.pickingReason = false;
	machineStoppedOverlay.reasonLocked = false;
	machineStoppedOverlay.productionAlert = false;
	machineStoppedOverlay.canOpen = opts?.allowReopen !== false;
	clearAutoAlertTimer();
}

/**
 * Operator dismisses the Machine Idle screen after selecting a reason.
 * Keeps the alert + idle timer; TaskBar chip can reopen it.
 */
export function dismissMachineIdleOverlay() {
	if (!selectedOverlayAlert.id) return;
	machineStoppedOverlay.isOpen = false;
	machineStoppedOverlay.pickingReason = false;
	machineStoppedOverlay.canOpen = false;
	clearAutoAlertTimer();
	ensureIdleTimer();
}

let remindTimer: ReturnType<typeof setTimeout> | undefined;

/** This machine's buzzer only (`/iow/stopBuzzer` / `/iow/triggerBuzzer` with `aid`, §3.2). */
function publishMachineBuzzer(on: boolean) {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(on ? '/iow/triggerBuzzer' : '/iow/stopBuzzer', withAssetId({}));
	});
}

/**
 * Production Alert "Snooze for 5 mins": hide the alert and silence this machine's buzzer (the
 * alarm itself stays raised). After 5 min, if the same alarm is still held (production has not
 * stopped and no job or login cleared it), the panel comes back and the buzzer sounds again.
 */
export function remindMachineIdleOverlayLater(ms = 5 * 60 * 1000) {
	const alertId = selectedOverlayAlert.id;
	if (!alertId) return;
	const silenced = machineStoppedOverlay.productionAlert;
	dismissMachineIdleOverlay();
	if (silenced) publishMachineBuzzer(false);
	clearTimeout(remindTimer);
	remindTimer = setTimeout(() => {
		if (selectedOverlayAlert.id !== alertId) return;
		if (!machineStoppedOverlay.isOpen) reopenMachineIdleOverlay();
		// Reopened early from the dock or not, the alarm is still on: sound it again.
		if (silenced && machineStoppedOverlay.productionAlert) publishMachineBuzzer(true);
	}, ms);
}

/** TaskBar / Lockscreen chip — reopen Machine Idle without resetting the timer. */
export function reopenMachineIdleOverlay() {
	if (!selectedOverlayAlert.id) return;
	openMachineIdleOverlay({ pickingReason: false, resetTimer: false });
}

/**
 * Tell the controller the idle reason picker is open so the stoppage (and ticket) start
 * now under `no_operator`, not when the operator eventually picks.
 * Change Reason / Close Ticket / production alarms must not call this.
 */
function publishOverlayOpened() {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(OVERLAY_OPENED_TOPIC, withAssetId({}));
	});
}

export function beginChangeIdleReason() {
	if (machineStoppedOverlay.reasonLocked) return;
	machineStoppedOverlay.pickingReason = true;
	machineStoppedOverlay.isOpen = true;
	ensureIdleTimer();
}

export function cancelChangeIdleReason() {
	// A selected reason means this picker was opened using Change Reason,
	// not the initial mandatory reason-selection flow.
	if (!selectedOverlayAlert.id) return;

	machineStoppedOverlay.pickingReason = false;
	machineStoppedOverlay.isOpen = true;
}

export function publishOverlayAlert(
	reason: StoppageReason,
	extras?: { type?: string; subAlertCode?: string },
	opts?: { resetTimer?: boolean }
) {
	globalMqtt.publish('/iow/stopBuzzer', {});
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(
			OVERLAY_ALERT_TOPIC,
			withAssetId({
				alertCode: reason.alertCode,
				...(extras?.type ? { type: extras.type } : {}),
				...(extras?.subAlertCode ? { subAlertCode: extras.subAlertCode } : {})
			})
		);
	});
	selectedOverlayAlert.id = reason.id;
	selectedOverlayAlert.label = reason.label;
	machineStoppedOverlay.pickingReason = false;
	machineStoppedOverlay.canOpen = false;
	// Change Reason → new pick starts a fresh UI epoch; auto-alert / first name keep enteredAt.
	if (opts?.resetTimer) startIdleTimer(0);
	else ensureIdleTimer();
}

export function selectOverlayReason(reasonId: number) {
	const reason =
		findCatalogReasonById(reasonId) ?? STOPPAGE_REASONS.find((entry) => entry.id === reasonId);
	if (!reason) return;
	// Change Reason leaves the previous id set while the picker is open; first pick has none.
	const changingReason = selectedOverlayAlert.id !== '';
	publishOverlayAlert(reason, undefined, { resetTimer: changingReason });
}

export function isSelectedOverlayReasonAcknowledgementRequired(): boolean {
	if (typeof selectedOverlayAlert.id !== 'number') return false;

	const reason =
		findCatalogReasonById(selectedOverlayAlert.id) ??
		STOPPAGE_REASONS.find((entry) => entry.id === selectedOverlayAlert.id);

	return reason?.requiresAck === true;
}

export function closeOverlayTicket() {
	if (!isSelectedOverlayReasonAcknowledgementRequired()) return;

	const reason =
		typeof selectedOverlayAlert.id === 'number'
			? (findCatalogReasonById(selectedOverlayAlert.id) ??
				STOPPAGE_REASONS.find((entry) => entry.id === selectedOverlayAlert.id))
			: undefined;
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(
			CLOSE_OVERLAY_TICKET_TOPIC,
			withAssetId({
				...(reason ? { alertCode: reason.alertCode } : {})
			})
		);
	});
	// Close now; ignore the immediate post-close `7001` and reopen on the next heartbeat.
	clearSelectedIdleAlert();
	closeMachineIdleOverlay({ allowReopen: true });
	deferIdleOverlayUntilConfirm = true;
}

function resolveReasonByCode(alertCode: string | null | undefined): StoppageReason | undefined {
	if (!alertCode) return undefined;
	const code = alertCode.trim().toLowerCase();
	if (!code) return undefined;
	return (
		findCatalogReasonByCode(code) ?? STOPPAGE_REASONS.find((entry) => entry.alertCode === code)
	);
}

/**
 * Reboot / late-bind recovery: if availability still carries a requiresAck reason, the
 * Close Ticket stoppage is still open — adopt it into the overlay. Do not adopt system
 * placeholders (awaiting_job, unclassified, …) or ordinary named reasons.
 */
function tryAdoptOpenAckReason(reasonCode: unknown): boolean {
	if (typeof reasonCode !== 'string') return false;
	const reason = resolveReasonByCode(reasonCode);
	if (!reason || reason.buttonNo == null || reason.requiresAck !== true) return false;

	selectedOverlayAlert.id = reason.id;
	selectedOverlayAlert.label = reason.label;
	machineStoppedOverlay.pickingReason = false;
	machineStoppedOverlay.canOpen = false;
	clearAutoAlertTimer();
	return true;
}

/**
 * Open Close Ticket UI immediately from controller `liveState:<aid>` (overlay-named or
 * job-stopped requiresAck). Does not wait for the next 7003.
 */
export async function restoreOpenAckOverlayFromLiveState(): Promise<void> {
	try {
		const aid = await ensureSelectedAssetId();
		if (!aid) return;

		const stored = await globalMqtt.get(`liveState:${aid}`);
		if (!stored || typeof stored !== 'object' || 'error' in stored) return;

		const current = (stored as { current?: Record<string, unknown> }).current;
		if (!current || typeof current !== 'object') return;
		if (!tryAdoptOpenAckReason(current.reason)) return;

		openMachineIdleOverlay({
			pickingReason: false,
			resetTimer: true,
			idleSeconds: idleSecondsFromEnteredAt(current.enteredAt)
		});
	} catch (error) {
		console.error('Failed to restore requiresAck overlay from liveState:', error);
	}
}

async function scheduleIdleAutoAlert() {
	// Always refresh from KV before arming — otherwise the first open can still
	// run on the in-memory default if sync at bind time raced or failed.
	await syncIdleAutoAlertTimeoutFromSettings({ rearm: false });
	armIdleAutoAlertTimer();
}

/**
 * Controller production-with-no-job / no-operator alarms (`PMS_MIGRATION` §7).
 * Only open from `/iow/productionWithNo*` — same moment the controller starts the buzzer.
 * UI-only: do not publish `/iow/overlayAlert` (that would raise 11001 while cutting).
 */
function showProductionAlarmOverlay(alert: { id: number; label: string }) {
	selectedOverlayAlert.id = alert.id;
	selectedOverlayAlert.label = alert.label;
	machineStoppedOverlay.reasonLocked = true;
	machineStoppedOverlay.productionAlert = true;
	machineStoppedOverlay.pickingReason = false;
	machineStoppedOverlay.canOpen = false;
	machineStoppedOverlay.isOpen = true;
	clearAutoAlertTimer();
	// The alarm fires after the alarm delay; the timer counts from when job-less production began.
	startIdleTimer(idleSecondsFromEnteredAt(productionEnteredAt));
}

function clearProductionAlarmOverlay() {
	if (!machineStoppedOverlay.reasonLocked) return;
	// The alarm is over: a pending snooze must not reopen it or sound the buzzer later.
	clearTimeout(remindTimer);
	clearSelectedIdleAlert();
	closeMachineIdleOverlay({ allowReopen: true });
}

function idleSecondsFromEnteredAt(enteredAt: unknown): number {
	if (typeof enteredAt !== 'string' || !enteredAt.trim()) return 0;
	const ms = Date.parse(enteredAt);
	if (!Number.isFinite(ms)) return 0;
	return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

type AvailabilityPl = {
	eid: number;
	machineState: number;
	oid?: unknown;
	jid?: unknown;
	reason?: unknown;
	enteredAt?: unknown;
	duration?: unknown;
	reasonRenamed?: boolean;
};

/**
 * Accept PMS `7001`/`7003` envelopes, or legacy eid `109` with ~60s `duration`.
 * Returns null when the message is not an availability signal for the idle overlay.
 */
function parseAvailabilityEvent(data: unknown): AvailabilityPl | null {
	if (!data || typeof data !== 'object') return null;
	const event = data as { eid?: number; pl?: Record<string, unknown> };
	const eid = event.eid;
	const pl = event.pl;
	if (!pl || typeof pl !== 'object') return null;

	const machineState = typeof pl.machineState === 'number' ? pl.machineState : null;
	if (machineState == null) return null;

	if (eid === STATE_CHANGED_EID || eid === STATE_CONFIRM_EID || eid === STATE_REASON_RENAMED_EID) {
		return {
			eid,
			machineState,
			oid: pl.oid,
			jid: pl.jid,
			reason: pl.reason,
			enteredAt: pl.enteredAt,
			reasonRenamed: eid === STATE_REASON_RENAMED_EID
		};
	}

	if (eid === LEGACY_AVAILABILITY_EID) {
		const duration = typeof pl.duration === 'number' ? pl.duration : 0;
		if (Math.abs(duration - EXPECTED_AVAILABILITY_DURATION_MS) > DURATION_TOLERANCE_MS) {
			return null;
		}
		return {
			eid,
			machineState,
			oid: pl.oid,
			jid: pl.jid,
			reason: pl.reason ?? pl.statusCode,
			duration
		};
	}

	return null;
}

/**
 * Availability drives idle state, but must not force the overlay open on every tick
 * once the operator has selected a reason and dismissed the screen.
 */
function handleMachineAvailability(data: unknown) {
	const pl = parseAvailabilityEvent(data);
	if (!pl) return;
	applyAvailability(pl);
}

function applyAvailability(pl: AvailabilityPl) {
	const currState = pl.machineState;
	machineIdleStore.machineState = currState;
	const noOperator = pl.oid == null || pl.oid === undefined;
	const noJob = !machineIdleJobContext.hasActiveJob && (pl.jid == null || pl.jid === undefined);
	const isProduction = currState === MACHINE_STATE.PRODUCTION;
	const idleSeconds = idleSecondsFromEnteredAt(pl.enteredAt);
	productionEnteredAt = isProduction ? pl.enteredAt : null;

	if (machineIdleJobContext.hasActiveJob) {
		prevMachineState = currState;
		return;
	}

	// Job Complete: wait for the next confirm/heartbeat, not the detach `7001`.
	if (deferIdleOverlayUntilConfirm) {
		const isHeartbeat = pl.eid === STATE_CONFIRM_EID || pl.eid === LEGACY_AVAILABILITY_EID;
		if (!isHeartbeat) {
			prevMachineState = currState;
			return;
		}
		deferIdleOverlayUntilConfirm = false;
	}

	// Keep the Production Alert while production continues (opened only via
	// `/iow/productionWithNo*`). When production stops, clear it and fall through
	// to the idle reason picker.
	if (machineStoppedOverlay.reasonLocked) {
		if (isProduction) {
			prevMachineState = currState;
			ensureIdleTimer();
			return;
		}

		clearProductionAlarmOverlay();
	}

	const leftJoblessProduction = prevMachineState === MACHINE_STATE.PRODUCTION && !isProduction;

	// Leaving jobless production (stall / job start) is a new idle epoch.
	if (leftJoblessProduction) {
		clearSelectedIdleAlert();
		machineStoppedOverlay.pickingReason = false;
		machineStoppedOverlay.canOpen = true;
	}

	if (skipNextAvailabilityUpdate) {
		skipNextAvailabilityUpdate = false;
		prevMachineState = currState;
		return;
	}

	if (pl.reasonRenamed && typeof pl.reason === 'string') {
		const renamedReason = resolveReasonByCode(pl.reason);

		if (renamedReason?.buttonNo != null) {
			selectedOverlayAlert.id = renamedReason.id;
			selectedOverlayAlert.label = renamedReason.label;
			machineStoppedOverlay.pickingReason = false;
			machineStoppedOverlay.canOpen = false;
			clearAutoAlertTimer();
		}
	}

	// requiresAck ticket still open (overlay or job-stopped) — Close Ticket UI, any jid/oid.
	if (tryAdoptOpenAckReason(pl.reason)) {
		openMachineIdleOverlay({
			pickingReason: false,
			resetTimer: true,
			idleSeconds
		});
		prevMachineState = currState;
		return;
	}

	// Same state + operator already dismissed → keep chip only, do not reopen.
	// Also covers the post-`overlayOpened` `7001` `no_operator` (same machineState, canOpen false).
	if (prevMachineState === currState && !machineStoppedOverlay.canOpen) {
		prevMachineState = currState;
		ensureIdleTimer();
		return;
	}

	// Jobless production: do NOT open the overlay from availability. Wait for
	// `/iow/productionWithNoJob` / `/iow/productionWithNoOperator` (after the alarm delay,
	// with the buzzer). Close any idle UI so the job screen stays usable until then.
	if (isProduction) {
		clearSelectedIdleAlert();
		closeMachineIdleOverlay({ allowReopen: true });
		clearAutoAlertTimer();
		prevMachineState = currState;
		return;
	}

	if (noOperator || noJob) {
		const needsReason = !selectedOverlayAlert.id;
		if (needsReason) {
			// Always show the picker; after autoAlertSelectTimeoutMs apply no_operator.
			// Do not pre-select wire system reasons (e.g. awaiting_job) — those are the
			// controller's idle placeholder, not an operator-chosen alert.
			if (machineStoppedOverlay.canOpen) {
				openMachineIdleOverlay({
					pickingReason: true,
					// After a production spell, start the idle timer fresh.
					resetTimer: leftJoblessProduction || !idleTimer,
					idleSeconds
				});
				autoAlertStartedAt = Date.now();
				publishOverlayOpened();
				globalMqtt.publish('/iow/triggerBuzzer', {});
				machineStoppedOverlay.canOpen = false;
			}
			void scheduleIdleAutoAlert();
		} else {
			ensureIdleTimer();
			if (machineStoppedOverlay.canOpen) {
				openMachineIdleOverlay({ pickingReason: false, resetTimer: false });
				machineStoppedOverlay.canOpen = false;
			}
		}
	} else {
		clearSelectedIdleAlert();
		closeMachineIdleOverlay({ allowReopen: true });
	}

	prevMachineState = currState;
}

export function bindMachineIdleMqttEvents(): () => void {
	mqttRefCount += 1;
	if (mqttBound) {
		return () => {
			mqttRefCount = Math.max(0, mqttRefCount - 1);
		};
	}

	mqttBound = true;
	onMqttEvent = (topic, data) => {
		if (topic === MACHINE_AVAILABILITY_TOPIC) {
			handleMachineAvailability(data);
			return;
		}
		if (topic === PRODUCTION_NO_OPERATOR_TOPIC) {
			showProductionAlarmOverlay({
				id: SYNTHETIC_ALERT.NO_LOGIN,
				label: 'No Login'
			});
			return;
		}
		if (topic === PRODUCTION_NO_JOB_TOPIC) {
			showProductionAlarmOverlay({
				id: SYNTHETIC_ALERT.NO_JOB,
				label: 'No Job'
			});
			return;
		}
		if (topic === PRODUCTION_ALARM_CLEARED_TOPIC) {
			clearProductionAlarmOverlay();
			return;
		}
		if (topic === MACHINE_SETTINGS_TOPIC) {
			void loadReasonsCatalog();
			void syncIdleAutoAlertTimeoutFromSettings();
		}
	};
	globalMqtt.subscribeTopics([
		MACHINE_AVAILABILITY_TOPIC,
		PRODUCTION_NO_OPERATOR_TOPIC,
		PRODUCTION_NO_JOB_TOPIC,
		PRODUCTION_ALARM_CLEARED_TOPIC,
		MACHINE_SETTINGS_TOPIC
	]);
	globalMqtt.on('event', onMqttEvent);
	void syncIdleAutoAlertTimeoutFromSettings();
	// Do not restore legacy KV `openTicket.overlayTicket` — the Path B controller does not
	// write that slice. Open requiresAck tickets come from `liveState:<aid>` (and 7003).
	void restoreOpenAckOverlayFromLiveState();

	return () => {
		mqttRefCount = Math.max(0, mqttRefCount - 1);
		if (mqttRefCount > 0) return;
		if (onMqttEvent) {
			globalMqtt.off('event', onMqttEvent);
			onMqttEvent = null;
		}
		mqttBound = false;
		clearAutoAlertTimer();
		clearIdleTimer();
	};
}

/**
 * After login: clear the HMI-only "No Login" alert (and a production alarm showing it) and reset the timer
 * only then. A held "No Operator" (7) is kept — the controller holds it until production, a job or another pick.
 */
export function onOperatorLoggedInForIdle() {
	if (selectedOverlayAlert.id === SYNTHETIC_ALERT.NO_LOGIN) {
		if (machineStoppedOverlay.reasonLocked) {
			clearProductionAlarmOverlay();
		} else {
			selectedOverlayAlert.id = '';
			selectedOverlayAlert.label = '';
			machineStoppedOverlay.canOpen = true;
		}
		startIdleTimer(0);
		return;
	}
	ensureIdleTimer();
}

/**
 * After logout / switch operator: clear the HMI-only "No Job" alert (and a production alarm showing it) and reset
 * the timer only then. A held "No Operator" (7) is kept — the controller holds it until production, a job or another pick.
 */
export function onOperatorLoggedOutForIdle() {
	if (selectedOverlayAlert.id === SYNTHETIC_ALERT.NO_JOB) {
		if (machineStoppedOverlay.reasonLocked) {
			clearProductionAlarmOverlay();
		} else {
			selectedOverlayAlert.id = '';
			selectedOverlayAlert.label = '';
			machineStoppedOverlay.canOpen = true;
		}
		startIdleTimer(0);
		return;
	}
	ensureIdleTimer();
}

/**
 * Badge for the selected alert: a catalog reason shows its number on the reason grid (1…n, as on
 * the picker); synthetic alarms (102 No Job / 103 No Login) keep their code. '' when none.
 */
export function selectedOverlayAlertBadge(): string | number {
	const id = selectedOverlayAlert.id;
	if (id === '') return '';
	const reason =
		typeof id === 'number'
			? findCatalogReasonById(id)
			: reasonsCatalog.reasons.find((entry) => entry.id === id);
	return (reason ? reasonNumber(reason, getSelectableCatalogReasons()) : null) ?? id;
}
