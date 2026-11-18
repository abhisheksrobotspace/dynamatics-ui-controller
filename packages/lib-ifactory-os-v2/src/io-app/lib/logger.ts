import { createAppLogger } from '$lib/os/index.js';

export const {
	debug: ioDebug,
	info: ioInfo,
	warn: ioWarn,
	error: ioError
} = createAppLogger('io-app');
