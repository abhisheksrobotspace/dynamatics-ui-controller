export interface IoPin {
	id: number;
	label: string;
	pin: number;
	status: number;
	signal?: string;
	description?: string;
	relay?: string;
}

export const IO_PIN_COUNT = 8;

export const OUTPUT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export const INPUT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

/** Hardware signal definitions according to the TG17 Pilot Electrical Schematic */
export const BOARD_IO_DEFINITIONS: Record<
	number,
	{
		label: string;
		title: string;
		outputs: Array<{ signal: string; relay?: string; description?: string }>;
		inputs: Array<{ signal: string; description?: string }>;
	}
> = {
	1: {
		label: 'ioX 1',
		title: 'U2 · Controls, Safety & Front SVs',
		outputs: [
			{ signal: 'SV-F1 (20 bar)', relay: 'K1', description: 'Front 20 bar Solenoid' },
			{ signal: 'SV-F2 (40 bar)', relay: 'K2', description: 'Front 40 bar Solenoid' },
			{ signal: 'SV-F3 (60 bar)', relay: 'K3', description: 'Front 60 bar Solenoid' },
			{ signal: 'SV-F4 (80 bar)', relay: 'K4', description: 'Front 80 bar Solenoid' },
			{ signal: 'SV-F5 (100 bar)', relay: 'K5', description: 'Front 100 bar Solenoid' },
			{ signal: 'SV-F6 (120 bar)', relay: 'K6', description: 'Front 120 bar Solenoid' },
			{ signal: 'SV-F7 (140 bar)', relay: 'K7', description: 'Front 140 bar Solenoid' },
			{ signal: 'SV-F8 (160 bar)', relay: 'K8', description: 'Front 160 bar Solenoid' }
		],
		inputs: [
			{ signal: 'E-Stop Aux (NC)', description: 'Emergency Stop Aux Contact (KS1)' },
			{ signal: 'VFD Fault', description: 'Yaskawa F7 Fault Relay MA/MC' },
			{ signal: 'VFD Running', description: 'Yaskawa F7 Running Relay M1/M2' },
			{ signal: 'Light Curtain KS2', description: 'Safety Light Curtain OSSD (Input 04)' },
			{ signal: 'Punch Reed HOME', description: 'Festo Cylinder Retracted Reed' },
			{ signal: 'Punch Reed EXT', description: 'Festo Cylinder Extended Reed' },
			{ signal: 'Spare DI7', description: 'Spare Digital Input' },
			{ signal: 'RPM Proximity', description: 'Motor Coupling Proximity Sensor (Input 08)' }
		]
	},
	2: {
		label: 'ioX 2',
		title: 'U3 · Front/Rear SVs & Flowmeter Front',
		outputs: [
			{ signal: 'SV-F9 (200 bar)', relay: 'K9', description: 'Front 200 bar Solenoid' },
			{ signal: 'SV-R1 (20 bar)', relay: 'K10', description: 'Rear 20 bar Solenoid' },
			{ signal: 'SV-R2 (40 bar)', relay: 'K11', description: 'Rear 40 bar Solenoid' },
			{ signal: 'SV-R3 (60 bar)', relay: 'K12', description: 'Rear 60 bar Solenoid' },
			{ signal: 'SV-R4 (80 bar)', relay: 'K13', description: 'Rear 80 bar Solenoid' },
			{ signal: 'SV-R5 (100 bar)', relay: 'K14', description: 'Rear 100 bar Solenoid' },
			{ signal: 'SV-R6 (120 bar)', relay: 'K15', description: 'Rear 120 bar Solenoid' },
			{ signal: 'SV-R7 (140 bar)', relay: 'K16', description: 'Rear 140 bar Solenoid' }
		],
		inputs: [
			{ signal: 'Start Button (NO)', description: 'Operator Start Pushbutton' },
			{ signal: 'Stop Button (NC)', description: 'Operator Stop Pushbutton' },
			{ signal: 'Spare DI3', description: 'Spare Digital Input' },
			{ signal: 'Spare DI4', description: 'Spare Digital Input' },
			{ signal: 'Spare DI5', description: 'Spare Digital Input' },
			{ signal: 'Spare DI6', description: 'Spare Digital Input' },
			{ signal: 'Flow FRONT A', description: 'Flowmeter Front 1000 ppr Pickup A' },
			{ signal: 'Flow FRONT B', description: 'Flowmeter Front 1000 ppr Pickup B' }
		]
	},
	3: {
		label: 'ioX 3',
		title: 'U4 · Rear SVs, Punch, VFD & Flowmeter Rear',
		outputs: [
			{ signal: 'SV-R8 (160 bar)', relay: 'K17', description: 'Rear 160 bar Solenoid' },
			{ signal: 'SV-R9 (200 bar)', relay: 'K18', description: 'Rear 200 bar Solenoid' },
			{ signal: 'Shock / Unload SV', relay: 'K19', description: 'Rapid Unload / Shock Valve' },
			{ signal: 'Punch SV 24V', relay: 'K20', description: 'Festo MSFG-24 Solenoid (via Safety)' },
			{ signal: 'VFD Run K21', relay: 'K21', description: 'VFD Run Contact S1-SC (via Safety)' },
			{ signal: 'Tower Lamp', relay: 'K22', description: 'Visual Indicator Lamp' },
			{ signal: 'Spare DO7', relay: 'K23', description: 'Spare Relay Contact' },
			{ signal: 'Spare DO8', relay: 'K24', description: 'Spare Relay Contact' }
		],
		inputs: [
			{ signal: 'Spare DI1', description: 'Spare Digital Input' },
			{ signal: 'Spare DI2', description: 'Spare Digital Input' },
			{ signal: 'Spare DI3', description: 'Spare Digital Input' },
			{ signal: 'Spare DI4', description: 'Spare Digital Input' },
			{ signal: 'Spare DI5', description: 'Spare Digital Input' },
			{ signal: 'Spare DI6', description: 'Spare Digital Input' },
			{ signal: 'Flow REAR A', description: 'Flowmeter Rear 1000 ppr Pickup A' },
			{ signal: 'Flow REAR B', description: 'Flowmeter Rear 1000 ppr Pickup B' }
		]
	}
};

/** Outputs stay board channels 0–7 (enclosure engraving matches board order). */
export function createDefaultOutputs(deviceId = 1): IoPin[] {
	const defs = BOARD_IO_DEFINITIONS[deviceId]?.outputs ?? [];
	return Array.from({ length: IO_PIN_COUNT }, (_, pin) => ({
		id: pin + 1,
		label: OUTPUT_LABELS[pin],
		pin,
		status: 0,
		signal: defs[pin]?.signal,
		relay: defs[pin]?.relay,
		description: defs[pin]?.description
	}));
}

/** Inputs use enclosure labels 1–8 — same `pin` HAL publishes on `/iow/hal/ip`. */
export function createDefaultInputs(deviceId = 1): IoPin[] {
	const defs = BOARD_IO_DEFINITIONS[deviceId]?.inputs ?? [];
	return Array.from({ length: IO_PIN_COUNT }, (_, index) => {
		const pin = index + 1;
		return {
			id: pin,
			label: INPUT_LABELS[index],
			pin,
			status: 0,
			signal: defs[index]?.signal,
			description: defs[index]?.description
		};
	});
}
