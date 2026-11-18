import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { createDefaultInputs, createDefaultOutputs, type IoPin } from './io-hardware.js';
import { ioDebug, ioInfo, ioWarn } from './logger.js';
import { IO_PUBLISH_TOPICS, IO_SUBSCRIBE_TOPICS } from './io-topics.js';

export type { IoPin };

export interface DeviceNetworkDetails {
	ssid?: string;
	quality?: string | number;
	wifiIp?: string;
	lanIp?: string;
	did?: string;
	mac?: string;
	updatedAt?: string;
}

export interface BoardStateData {
	id: number;
	label: string;
	inputs: IoPin[];
	outputs: IoPin[];
	online: boolean | null;
	updatedAt: Date | null;
}

export interface RigInstruments {
	pressure: {
		front: number;
		rear: number;
		raw_front_ma: number;
		raw_rear_ma: number;
		online: boolean;
	};
	temperature: {
		oil: number;
		probe_open?: boolean;
		online: boolean;
	};
	energy: {
		v_l1: number;
		i_l1: number;
		kw_total: number;
		hz_mains: number;
		online: boolean;
	};
	flow: {
		front_lpm: number;
		rear_lpm: number;
		front_pulses: number;
		rear_pulses: number;
		online: boolean;
	};
	rpm: {
		rpm: number;
		online: boolean;
	};
	safety: {
		estop_ok: boolean;
		curtain_ok: boolean;
		vfd_fault: boolean;
		vfd_running: boolean;
		safety_ok: boolean;
		km1_ok: boolean;
	};
	vfd: {
		hz: number;
		fault: boolean;
		running: boolean;
		speed_cmd_v: number;
	};
}

export type RigStateName =
	| 'INIT'
	| 'IDLE'
	| 'SCAN_LOAD'
	| 'PRECHECK'
	| 'MOTOR_START'
	| 'CUTTING_IN'
	| 'SHOCK'
	| 'CALIBRATION'
	| 'LEAK_CHECK'
	| 'FLUSH'
	| 'MOTOR_STOP'
	| 'EVALUATE'
	| 'PASS_PUNCH'
	| 'FAIL_DEFECT'
	| 'SAVE_RECORD'
	| 'UNLOAD'
	| 'MANUAL'
	| 'SAFETY_STOP'
	| 'FAULT'
	| 'ABORT';

export interface CuttingStage {
	bar: number;
	sec: number;
}

export interface PumpModelRecipe {
	partNo: string;
	description: string;
	circuit: 'single' | 'tandem' | 'double';
	rotation: 'CW' | 'ACW';
	speedRpm: number;
	speedTol: number;
	tempTarget: number;
	tempTol: number;
	stages: CuttingStage[];
	shockCount: number;
	shockOnSec: number;
	shockOffSec: number;
	flushSec: number;
	calibrationHoldSec: number;
	frontTestPressure: number;
	rearTestPressure: number | null;
	pressureTol: number;
	frontFlowMin: number;
	rearFlowMin: number | null;
	volEffMin: number;
	dispCcFront: number;
	dispCcRear: number | null;
}

export interface RigLiveReadings {
	pFront: number;
	pRear: number;
	flowFront: number;
	flowRear: number;
	rpm: number;
	temp: number;
	volEffFront: number | null;
	volEffRear: number | null;
	kw: number;
	vL1: number;
	iL1: number;
	hz: number;
}

export interface RigEvaluation {
	passed: boolean;
	volEffOk: boolean;
	flowFrontOk: boolean;
	flowRearOk: boolean;
	rpmOk: boolean;
	pressureOk: boolean;
	tempOk: boolean;
	leakOk: boolean;
	failures: string[];
}

export interface RigTestRecord {
	recordId: string;
	serial: string;
	partNo: string;
	modelDescription: string;
	operator: string;
	shift: string;
	startTime: string;
	endTime: string;
	durationSec: number;
	result: 'PASS' | 'FAIL' | 'ABORTED';
	defectCode?: string;
	defectDescription?: string;
	measured: {
		avgRpm: number;
		avgTemp: number;
		avgKw: number;
		frontPressureBar: number;
		rearPressureBar?: number;
		frontFlowLpm: number;
		rearFlowLpm?: number;
		frontVolEffPct: number;
		rearVolEffPct?: number;
	};
	limits: {
		targetPressureBar: number;
		minFlowFront: number;
		minFlowRear?: number;
		minVolEffPct: number;
	};
	evaluation: RigEvaluation;
}

export interface RigStateTelemetry {
	state: RigStateName;
	stateIndex: number;
	mode: 'AUTO' | 'MANUAL';
	model: PumpModelRecipe | null;
	serial: string;
	operator: string;
	shift: string;
	stage: {
		current: number;
		total: number;
		targetBar: number;
		elapsedSec: number;
		holdSec: number;
	} | null;
	shock: {
		current: number;
		total: number;
		phase: 'ON' | 'OFF';
		elapsedSec: number;
	} | null;
	calibration: {
		elapsedSec: number;
		totalSec: number;
	} | null;
	flush: {
		elapsedSec: number;
		totalSec: number;
	} | null;
	readings: RigLiveReadings;
	checklist: {
		safetyOk: boolean;
		punchHome: boolean;
		pressureZero: boolean;
		oilTempOk: boolean;
		pumpMounted: boolean;
	};
	fault: {
		code: string;
		message: string;
		time: number;
	} | null;
	lastResult: 'PASS' | 'FAIL' | 'ABORTED' | null;
	timestamp: number;
}

function asOptionalString(value: unknown): string | undefined {
	if (value == null) return undefined;
	const next = String(value).trim();
	return next || undefined;
}

function parseDeviceSettings(data: unknown): DeviceNetworkDetails | null {
	if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
		return null;
	}

	const payload = data as Record<string, unknown>;
	const wifi = payload.wifi as { ip?: unknown } | undefined;
	const lan = payload.lan as { ip?: unknown } | undefined;

	let wifiIp =
		asOptionalString(payload.wifiIp) ??
		asOptionalString(wifi?.ip) ??
		asOptionalString(payload.wlanIp);
	let lanIp =
		asOptionalString(payload.lanIp) ?? asOptionalString(lan?.ip) ?? asOptionalString(payload.ethIp);

	const legacyIp = asOptionalString(payload.ip);
	const ssid = asOptionalString(payload.ssid);
	const isLanConnected = Boolean(ssid?.includes('LAN Connected'));

	if (legacyIp) {
		if (!wifiIp && !isLanConnected) {
			wifiIp = legacyIp;
		}
		if (!lanIp && isLanConnected) {
			lanIp = legacyIp;
		}
		if (!wifiIp && !lanIp) {
			wifiIp = legacyIp;
		}
	}

	return {
		ssid,
		quality: payload.quality as string | number | undefined,
		wifiIp,
		lanIp,
		did: asOptionalString(payload.did),
		mac: asOptionalString(payload.mac),
		updatedAt: new Date().toLocaleString()
	};
}

/** Reactive states for the 3 daisy-chained iOX boards */
export const boardStates = $state<Record<number, BoardStateData>>({
	1: {
		id: 1,
		label: 'ioX 1',
		inputs: createDefaultInputs(1),
		outputs: createDefaultOutputs(1),
		online: null,
		updatedAt: null
	},
	2: {
		id: 2,
		label: 'ioX 2',
		inputs: createDefaultInputs(2),
		outputs: createDefaultOutputs(2),
		online: null,
		updatedAt: null
	},
	3: {
		id: 3,
		label: 'ioX 3',
		inputs: createDefaultInputs(3),
		outputs: createDefaultOutputs(3),
		online: null,
		updatedAt: null
	}
});

/** Currently selected board id (1, 2, 3) or 4 for instruments */
export const activeDevice = $state({ id: 1 });

export function selectDevice(id: number) {
	activeDevice.id = id;
}

export function getOutputs(id = activeDevice.id) {
	return boardStates[id]?.outputs ?? boardStates[1].outputs;
}

export function getInputs(id = activeDevice.id) {
	return boardStates[id]?.inputs ?? boardStates[1].inputs;
}

export function getIoLink(id = activeDevice.id) {
	return {
		online: boardStates[id]?.online ?? boardStates[1].online,
		updatedAt: boardStates[id]?.updatedAt ?? boardStates[1].updatedAt
	};
}

export const network = $state({} as DeviceNetworkDetails);

/** Reactive state for RS485 daisy-chained sensors and instruments */
export const instruments = $state<RigInstruments>({
	pressure: {
		front: 0,
		rear: 0,
		raw_front_ma: 0,
		raw_rear_ma: 0,
		online: false
	},
	temperature: {
		oil: 0,
		online: false
	},
	energy: {
		v_l1: 0,
		i_l1: 0,
		kw_total: 0,
		hz_mains: 0,
		online: false
	},
	flow: {
		front_lpm: 0,
		rear_lpm: 0,
		front_pulses: 0,
		rear_pulses: 0,
		online: false
	},
	rpm: {
		rpm: 0,
		online: false
	},
	safety: {
		estop_ok: false,
		curtain_ok: false,
		vfd_fault: false,
		vfd_running: false,
		safety_ok: false,
		km1_ok: false
	},
	vfd: {
		hz: 0,
		fault: false,
		running: false,
		speed_cmd_v: 0
	}
});

/** Reactive state for Rig Automation State Machine */
export const rigState = $state<RigStateTelemetry>({
	state: 'INIT',
	stateIndex: 0,
	mode: 'AUTO',
	model: null,
	serial: '',
	operator: 'OP-01',
	shift: 'Shift-A',
	stage: null,
	shock: null,
	calibration: null,
	flush: null,
	readings: {
		pFront: 0,
		pRear: 0,
		flowFront: 0,
		flowRear: 0,
		rpm: 0,
		temp: 0,
		volEffFront: null,
		volEffRear: null,
		kw: 0,
		vL1: 0,
		iL1: 0,
		hz: 0
	},
	checklist: {
		safetyOk: true,
		punchHome: true,
		pressureZero: true,
		oilTempOk: false,
		pumpMounted: false
	},
	fault: null,
	lastResult: null,
	timestamp: 0
});

export const lastRigRecord = $state<{ record: RigTestRecord | null }>({ record: null });

function markBoardUpdated(deviceId: number) {
	const b = boardStates[deviceId];
	if (b) {
		b.online = true;
		b.updatedAt = new Date();
	}
}

let mqttBound = false;

function applyPinMap(pins: IoPin[], map: Record<string, number | string>): void {
	for (const entry of pins) {
		if (Object.hasOwn(map, String(entry.pin))) {
			entry.status = Number.parseInt(String(map[entry.pin]), 10) || 0;
		}
	}
}

function handleInitialGpioStatus(data: unknown) {
	const payload = data as {
		data?: {
			devices?: Record<
				string,
				{
					id?: number;
					inputs?: Record<string, number>;
					outputs?: Record<string, number>;
					online?: boolean;
				}
			>;
			instruments?: Partial<RigInstruments>;
			inputs?: Record<string, number>;
			outputs?: Record<string, number>;
		};
	};

	if (!payload?.data || typeof payload.data !== 'object') return;

	ioInfo('status-response', { hasData: true });

	// If multi-device payload is present
	if (payload.data.devices) {
		for (const [idStr, dev] of Object.entries(payload.data.devices)) {
			const id = Number(idStr);
			const board = boardStates[id];
			if (board) {
				board.online = Boolean(dev.online);
				board.updatedAt = new Date();
				if (dev.inputs) applyPinMap(board.inputs, dev.inputs);
				if (dev.outputs) applyPinMap(board.outputs, dev.outputs);
			}
		}
	} else {
		// Fallback for single board (ioX 1)
		markBoardUpdated(1);
		if (payload.data.inputs) applyPinMap(boardStates[1].inputs, payload.data.inputs);
		if (payload.data.outputs) applyPinMap(boardStates[1].outputs, payload.data.outputs);
	}

	// Update instruments if included
	if (payload.data.instruments) {
		Object.assign(instruments, payload.data.instruments);
	}
}

function handleGpioInputStatus(data: unknown) {
	const payload = data as { deviceId?: number; board?: number; id?: number; pin?: number; val?: 0 | 1 };
	const deviceId = payload.deviceId ?? payload.board ?? payload.id ?? 1;
	const pin = payload.pin;
	const val = payload.val;

	if (pin === undefined || val === undefined) {
		ioWarn('input-hal ignored', { data });
		return;
	}

	const board = boardStates[deviceId];
	if (!board) return;

	markBoardUpdated(deviceId);
	for (const input of board.inputs) {
		if (input.pin === pin) {
			input.status = val;
			break;
		}
	}
}

function handleOutputStatus(data: unknown) {
	const payload = data as { deviceId?: number; board?: number; id?: number; pin?: number; val?: 0 | 1 };
	const deviceId = payload.deviceId ?? payload.board ?? payload.id ?? 1;
	const pin = payload.pin;
	const val = payload.val;

	if (pin === undefined || val === undefined) {
		ioWarn('output-hal ignored', { data });
		return;
	}

	const board = boardStates[deviceId];
	if (!board) return;

	markBoardUpdated(deviceId);
	for (const output of board.outputs) {
		if (output.pin === pin) {
			output.status = val;
			break;
		}
	}
}

function handleOffline(data: unknown) {
	const payload = data as { deviceId?: number; failures: number };
	const deviceId = payload.deviceId ?? 1;
	ioWarn('offline', { deviceId, failures: payload.failures });
	const board = boardStates[deviceId];
	if (board) board.online = false;
}

function handleOnline(data: unknown) {
	const payload = data as { deviceId?: number; inputs: number };
	const deviceId = payload.deviceId ?? 1;
	ioInfo('online', { deviceId, inputs: payload.inputs });
	const board = boardStates[deviceId];
	if (board) {
		board.online = true;
		board.updatedAt = new Date();
	}
}

function handleExtenderReboot(data: unknown) {
	const payload = data as { deviceId?: number; uptimeSec: number };
	ioInfo('extender-reboot', { deviceId: payload.deviceId ?? 1, uptimeSec: payload.uptimeSec });
}

function handleDeviceSettings(data: unknown) {
	const networkDetails = parseDeviceSettings(data);
	if (networkDetails) {
		Object.assign(network, networkDetails);
	}
}

function handleInstrumentsTelemetry(data: unknown) {
	const payload = data as { data?: Partial<RigInstruments> };
	if (payload?.data && typeof payload.data === 'object') {
		if (payload.data.pressure) Object.assign(instruments.pressure, payload.data.pressure);
		if (payload.data.temperature) Object.assign(instruments.temperature, payload.data.temperature);
		if (payload.data.energy) Object.assign(instruments.energy, payload.data.energy);
		if (payload.data.flow) Object.assign(instruments.flow, payload.data.flow);
		if (payload.data.rpm) Object.assign(instruments.rpm, payload.data.rpm);
		if (payload.data.safety) Object.assign(instruments.safety, payload.data.safety);
		if (payload.data.vfd) Object.assign(instruments.vfd, payload.data.vfd);
	}
}

function handleRigState(data: unknown) {
	if (!data || typeof data !== 'object') return;
	const payload = data as Partial<RigStateTelemetry>;
	Object.assign(rigState, payload);
}

function handleRigRecord(data: unknown) {
	if (!data || typeof data !== 'object') return;
	lastRigRecord.record = data as RigTestRecord;
}

const topicHandlers: Record<string, (data: unknown) => void> = {
	[IO_SUBSCRIBE_TOPICS.STATUS_RESPONSE]: handleInitialGpioStatus,
	[IO_SUBSCRIBE_TOPICS.GPIO_INPUT]: handleGpioInputStatus,
	[IO_SUBSCRIBE_TOPICS.GPIO_OUTPUT]: handleOutputStatus,
	[IO_SUBSCRIBE_TOPICS.OFFLINE]: handleOffline,
	[IO_SUBSCRIBE_TOPICS.ONLINE]: handleOnline,
	[IO_SUBSCRIBE_TOPICS.EXTENDER_REBOOT]: handleExtenderReboot,
	[IO_SUBSCRIBE_TOPICS.DEVICE_SETTINGS]: handleDeviceSettings,
	[IO_SUBSCRIBE_TOPICS.INSTRUMENTS]: handleInstrumentsTelemetry,
	[IO_SUBSCRIBE_TOPICS.RIG_STATE]: handleRigState,
	[IO_SUBSCRIBE_TOPICS.RIG_RECORD]: handleRigRecord
};

export function bindIoMqttEvents(): () => void {
	if (mqttBound) {
		return () => {};
	}

	const onEvent = (topic: string, data: unknown) => {
		topicHandlers[topic]?.(data);
	};

	globalMqtt.subscribeTopics(Object.values(IO_SUBSCRIBE_TOPICS));
	globalMqtt.on('event', onEvent);
	mqttBound = true;
	ioInfo('mqtt-bound');

	requestIoStatus();
	globalMqtt.publish(IO_PUBLISH_TOPICS.GET_DEVICE_SETTINGS, {});

	return () => {
		globalMqtt.off('event', onEvent);
		mqttBound = false;
		ioInfo('mqtt-unbound');
	};
}

export function requestIoStatus(): void {
	ioDebug('requestIoStatus');
	globalMqtt.publish(IO_PUBLISH_TOPICS.STATUS_REQUEST, {});
}

export function toggleOutput(deviceId: number, pin: number, value: number): void {
	ioDebug('toggleOutput', { deviceId, pin, value });
	globalMqtt.publish(IO_PUBLISH_TOPICS.OUTPUT_TOGGLE, { deviceId, pin, val: value });
}

export function toggleInput(deviceId: number, pin: number, value: number): void {
	ioDebug('toggleInput', { deviceId, pin, value });
	globalMqtt.publish(IO_PUBLISH_TOPICS.GPIO_INPUT, { deviceId, pin, val: value, src: 'ui' });
}

/** Switch outputs off on a specific board or all boards */
export function allOutputsOff(deviceId?: number): void {
	if (deviceId !== undefined) {
		const board = boardStates[deviceId];
		if (board) {
			for (const output of board.outputs) {
				if (!output.status) continue;
				output.status = 0;
				toggleOutput(deviceId, output.pin, 0);
			}
		}
	} else {
		// All boards
		globalMqtt.publish(IO_PUBLISH_TOPICS.ALL_OFF, {});
		for (const board of Object.values(boardStates)) {
			for (const output of board.outputs) {
				output.status = 0;
			}
		}
	}
}

export function setVfdSpeed(speedV: number): void {
	ioDebug('setVfdSpeed', { speedV });
	globalMqtt.publish(IO_PUBLISH_TOPICS.SET_VFD_SPEED, { speed_v: speedV });
}

// ---------------------------------------------------------------------------
// Rig Automation Commands
// ---------------------------------------------------------------------------

export function scanRigPump(barcode: string): void {
	ioDebug('scanRigPump', { barcode });
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_SCAN, { barcode });
}

export function startRigTest(): void {
	ioDebug('startRigTest');
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_START, {});
}

export function submitRigUvLeak(passed: boolean): void {
	ioDebug('submitRigUvLeak', { passed });
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_UV_LEAK_RESULT, { passed });
}

export function submitRigDefectCode(code: string, note?: string): void {
	ioDebug('submitRigDefectCode', { code, note });
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_DEFECT_CODE, { code, note });
}

export function confirmRigUnload(): void {
	ioDebug('confirmRigUnload');
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_UNLOAD_CONFIRM, {});
}

export function abortRigTest(reason = 'Operator HMI Abort'): void {
	ioDebug('abortRigTest', { reason });
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_ABORT, { reason });
}

export function resetRigFault(): void {
	ioDebug('resetRigFault');
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_RESET_FAULT, {});
}

export function setRigMode(mode: 'AUTO' | 'MANUAL'): void {
	ioDebug('setRigMode', { mode });
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_SET_MODE, { mode });
}

export function setRigOperator(operator: string, shift: string): void {
	ioDebug('setRigOperator', { operator, shift });
	globalMqtt.publish(IO_PUBLISH_TOPICS.RIG_OPERATOR, { operator, shift });
}
