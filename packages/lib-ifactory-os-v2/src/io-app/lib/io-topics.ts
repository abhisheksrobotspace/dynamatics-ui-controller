/** MQTT topics for IO app ↔ controller (aligned with ifactoryai-os and multi-ioX daisy chain). */

export const IO_PUBLISH_TOPICS = {
	STATUS_REQUEST: '/iow/status-request',
	OUTPUT_TOGGLE: '/iow/hal/op',
	GPIO_INPUT: '/iow/hal/ip',
	GET_DEVICE_SETTINGS: '/iow/getDeviceSettings',
	ALL_OFF: '/iow/hal/all-off',
	SET_VFD_SPEED: '/iow/instruments/vfd-speed',
	RIG_SCAN: '/rig/cmd/scan',
	RIG_START: '/rig/cmd/start',
	RIG_UV_LEAK_RESULT: '/rig/cmd/uv-leak-result',
	RIG_DEFECT_CODE: '/rig/cmd/defect-code',
	RIG_UNLOAD_CONFIRM: '/rig/cmd/unload-confirm',
	RIG_ABORT: '/rig/cmd/abort',
	RIG_RESET_FAULT: '/rig/cmd/reset-fault',
	RIG_SET_MODE: '/rig/cmd/set-mode',
	RIG_OPERATOR: '/rig/cmd/operator'
} as const;

export const IO_SUBSCRIBE_TOPICS = {
	STATUS_RESPONSE: '/iow/status-response',
	GPIO_INPUT: '/iow/hal/ip',
	GPIO_OUTPUT: '/iow/hal/op',
	POLL: '/iow/hal/poll',
	OFFLINE: '/iow/hal/offline',
	ONLINE: '/iow/hal/online',
	EXTENDER_REBOOT: '/iow/hal/extender-reboot',
	DEVICE_SETTINGS: '/iow/deviceSettings',
	INSTRUMENTS: '/iow/instruments',
	RIG_STATE: '/rig/state',
	RIG_RECORD: '/rig/record'
} as const;
