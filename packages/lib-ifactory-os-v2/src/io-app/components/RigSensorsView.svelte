<script lang="ts">
	import { instruments, setVfdSpeed } from '../lib/io-store.svelte.js';
	import {
		Gauge,
		Thermometer,
		Zap,
		Activity,
		ShieldCheck,
		ShieldAlert,
		RotateCw,
		Sliders
	} from '@lucide/svelte';
	import { HmiFlatButton } from '@ifactory/ui-v2';

	let { disabled = false }: { disabled?: boolean } = $props();

	let customSpeedV = $state(0);

	function applySpeed(val: number) {
		if (disabled) return;
		customSpeedV = val;
		setVfdSpeed(val);
	}
</script>

<div class="flex flex-col gap-5 overflow-y-auto font-body pb-6">
	<!-- Row 1: Pressure & Temperature Sensors -->
	<div class="grid grid-cols-3 gap-4">
		<!-- Front Pressure -->
		<div class="flex flex-col justify-between p-4 rounded-[12px] bg-white border border-[#c3c8cf] shadow-sm">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="flex size-9 items-center justify-center rounded-lg bg-[#fff2e8] text-[#f26b2a]">
						<Gauge class="size-5" />
					</div>
					<div>
						<h3 class="m-0 text-base font-bold text-[#1b2028]">Front Pressure</h3>
						<span class="text-xs text-[#7d848c]">PT5400 · 0–400 bar (ID 21)</span>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs font-bold">
					<span class="size-2.5 rounded-full {instruments.pressure.online ? 'bg-[#2e9e4f]' : 'bg-[#e0564c]'}"></span>
					<span class="text-[#5a616c]">{instruments.pressure.online ? 'Online' : 'Offline'}</span>
				</span>
			</div>

			<div class="my-3 flex items-baseline justify-between">
				<div class="flex items-baseline gap-1.5">
					<span class="text-4xl font-extrabold text-[#1b2028]">{instruments.pressure.front.toFixed(1)}</span>
					<span class="text-lg font-bold text-[#7d848c]">bar</span>
				</div>
				<span class="text-xs font-semibold text-[#5a616c]">
					{instruments.pressure.raw_front_ma.toFixed(2)} mA
				</span>
			</div>

			<div class="w-full bg-[#f0f2f5] rounded-full h-2.5 overflow-hidden">
				<div
					class="bg-[#f26b2a] h-2.5 rounded-full transition-all duration-300"
					style="width: {Math.min(100, (instruments.pressure.front / 400) * 100)}%"
				></div>
			</div>
		</div>

		<!-- Rear Pressure -->
		<div class="flex flex-col justify-between p-4 rounded-[12px] bg-white border border-[#c3c8cf] shadow-sm">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="flex size-9 items-center justify-center rounded-lg bg-[#fff2e8] text-[#f26b2a]">
						<Gauge class="size-5" />
					</div>
					<div>
						<h3 class="m-0 text-base font-bold text-[#1b2028]">Rear Pressure</h3>
						<span class="text-xs text-[#7d848c]">PT5400 · 0–400 bar (ID 21)</span>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs font-bold">
					<span class="size-2.5 rounded-full {instruments.pressure.online ? 'bg-[#2e9e4f]' : 'bg-[#e0564c]'}"></span>
					<span class="text-[#5a616c]">{instruments.pressure.online ? 'Online' : 'Offline'}</span>
				</span>
			</div>

			<div class="my-3 flex items-baseline justify-between">
				<div class="flex items-baseline gap-1.5">
					<span class="text-4xl font-extrabold text-[#1b2028]">{instruments.pressure.rear.toFixed(1)}</span>
					<span class="text-lg font-bold text-[#7d848c]">bar</span>
				</div>
				<span class="text-xs font-semibold text-[#5a616c]">
					{instruments.pressure.raw_rear_ma.toFixed(2)} mA
				</span>
			</div>

			<div class="w-full bg-[#f0f2f5] rounded-full h-2.5 overflow-hidden">
				<div
					class="bg-[#f26b2a] h-2.5 rounded-full transition-all duration-300"
					style="width: {Math.min(100, (instruments.pressure.rear / 400) * 100)}%"
				></div>
			</div>
		</div>

		<!-- Oil Temperature -->
		<div class="flex flex-col justify-between p-4 rounded-[12px] bg-white border border-[#c3c8cf] shadow-sm">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="flex size-9 items-center justify-center rounded-lg bg-[#ebf5ff] text-[#2563eb]">
						<Thermometer class="size-5" />
					</div>
					<div>
						<h3 class="m-0 text-base font-bold text-[#1b2028]">Oil Temperature</h3>
						<span class="text-xs text-[#7d848c]">PT100 3-Wire · ID 11 (50 ± 5 °C)</span>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs font-bold">
					<span class="size-2.5 rounded-full {instruments.temperature.online ? 'bg-[#2e9e4f]' : 'bg-[#e0564c]'}"></span>
					<span class="text-[#5a616c]">{instruments.temperature.online ? 'Online' : 'Offline'}</span>
				</span>
			</div>

			<div class="my-3 flex items-baseline justify-between">
				<div class="flex items-baseline gap-1.5">
					<span class="text-4xl font-extrabold text-[#1b2028]">{instruments.temperature.oil.toFixed(1)}</span>
					<span class="text-lg font-bold text-[#7d848c]">°C</span>
				</div>
				<span class="px-2 py-0.5 rounded text-xs font-bold {instruments.temperature.probe_open ? 'bg-[#fef3c7] text-[#b45309]' : instruments.temperature.oil > 55 ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#e0f2fe] text-[#0369a1]'}">
					{instruments.temperature.probe_open ? 'Probe Disconnected (Open)' : instruments.temperature.oil > 55 ? 'Cooling SV Y20 ON' : 'Normal'}
				</span>
			</div>

			<div class="w-full bg-[#f0f2f5] rounded-full h-2.5 overflow-hidden">
				<div
					class="bg-[#2563eb] h-2.5 rounded-full transition-all duration-300"
					style="width: {Math.min(100, (instruments.temperature.oil / 100) * 100)}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Row 2: 3-Phase Energy Meter & Flowmeters -->
	<div class="grid grid-cols-2 gap-4">
		<!-- Energy Meter Selec MFM384-C -->
		<div class="flex flex-col p-4 rounded-[12px] bg-white border border-[#c3c8cf] shadow-sm">
			<div class="flex items-center justify-between pb-3 border-b border-[#e0e3e8]">
				<div class="flex items-center gap-2">
					<div class="flex size-9 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
						<Zap class="size-5" />
					</div>
					<div>
						<h3 class="m-0 text-base font-bold text-[#1b2028]">Selec Energy Meter (ID 10)</h3>
						<span class="text-xs text-[#7d848c]">MFM384-C · 3x CT 75/5A + V1-V3 Taps</span>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs font-bold">
					<span class="size-2.5 rounded-full {instruments.energy.online ? 'bg-[#2e9e4f]' : 'bg-[#e0564c]'}"></span>
					<span class="text-[#5a616c]">{instruments.energy.online ? 'Online' : 'Offline'}</span>
				</span>
			</div>

			<div class="grid grid-cols-4 gap-3 mt-3">
				<div class="flex flex-col p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="text-xs font-semibold text-[#64748b]">Voltage L1</span>
					<span class="text-2xl font-bold text-[#1b2028] mt-1">{instruments.energy.v_l1.toFixed(1)}</span>
					<span class="text-[11px] font-medium text-[#94a3b8]">Volts AC</span>
				</div>
				<div class="flex flex-col p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="text-xs font-semibold text-[#64748b]">Current I1</span>
					<span class="text-2xl font-bold text-[#1b2028] mt-1">{instruments.energy.i_l1.toFixed(1)}</span>
					<span class="text-[11px] font-medium text-[#94a3b8]">Amperes</span>
				</div>
				<div class="flex flex-col p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="text-xs font-semibold text-[#64748b]">Active Power</span>
					<span class="text-2xl font-bold text-[#1b2028] mt-1">{instruments.energy.kw_total.toFixed(2)}</span>
					<span class="text-[11px] font-medium text-[#94a3b8]">kW</span>
				</div>
				<div class="flex flex-col p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="text-xs font-semibold text-[#64748b]">Frequency</span>
					<span class="text-2xl font-bold text-[#1b2028] mt-1">{instruments.energy.hz_mains.toFixed(1)}</span>
					<span class="text-[11px] font-medium text-[#94a3b8]">Hz</span>
				</div>
			</div>
		</div>

		<!-- Flowmeters & RPM -->
		<div class="flex flex-col p-4 rounded-[12px] bg-white border border-[#c3c8cf] shadow-sm">
			<div class="flex items-center justify-between pb-3 border-b border-[#e0e3e8]">
				<div class="flex items-center gap-2">
					<div class="flex size-9 items-center justify-center rounded-lg bg-[#ede9fe] text-[#7c3aed]">
						<Activity class="size-5" />
					</div>
					<div>
						<h3 class="m-0 text-base font-bold text-[#1b2028]">Flowmeters & Encoder</h3>
						<span class="text-xs text-[#7d848c]">1000 ppr A/B Encoders + Coupling Proximity</span>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs font-bold">
					<span class="size-2.5 rounded-full {instruments.flow.online ? 'bg-[#2e9e4f]' : 'bg-[#e0564c]'}"></span>
					<span class="text-[#5a616c]">{instruments.flow.online ? 'Online' : 'Offline'}</span>
				</span>
			</div>

			<div class="grid grid-cols-3 gap-3 mt-3">
				<div class="flex flex-col p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="text-xs font-semibold text-[#64748b]">Front Flow</span>
					<span class="text-2xl font-bold text-[#1b2028] mt-1">{instruments.flow.front_lpm.toFixed(1)}</span>
					<span class="text-[11px] font-medium text-[#94a3b8]">LPM ({instruments.flow.front_pulses} pulses)</span>
				</div>
				<div class="flex flex-col p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="text-xs font-semibold text-[#64748b]">Rear Flow</span>
					<span class="text-2xl font-bold text-[#1b2028] mt-1">{instruments.flow.rear_lpm.toFixed(1)}</span>
					<span class="text-[11px] font-medium text-[#94a3b8]">LPM ({instruments.flow.rear_pulses} pulses)</span>
				</div>
				<div class="flex flex-col p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="text-xs font-semibold text-[#64748b]">Shaft Speed</span>
					<span class="text-2xl font-bold text-[#1b2028] mt-1">{instruments.rpm.rpm}</span>
					<span class="text-[11px] font-medium text-[#94a3b8]">RPM (ioX 1 DI8)</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Row 3: Safety Interlocks & VFD Speed Control -->
	<div class="grid grid-cols-2 gap-4">
		<!-- Safety Chain Status -->
		<div class="flex flex-col p-4 rounded-[12px] bg-white border border-[#c3c8cf] shadow-sm">
			<div class="flex items-center justify-between pb-3 border-b border-[#e0e3e8]">
				<div class="flex items-center gap-2">
					<div class="flex size-9 items-center justify-center rounded-lg bg-[#f0fdf4] text-[#16a34a]">
						<ShieldCheck class="size-5" />
					</div>
					<div>
						<h3 class="m-0 text-base font-bold text-[#1b2028]">Safety Relays & Interlocks</h3>
						<span class="text-xs text-[#7d848c]">KS1 E-Stop · KS2 Light Curtain · KM1 Supply Contactor</span>
					</div>
				</div>
				<span class="px-2.5 py-1 rounded text-xs font-bold {instruments.safety.safety_ok ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}">
					{instruments.safety.safety_ok ? 'SAFETY OK' : 'INTERLOCKED'}
				</span>
			</div>

			<div class="grid grid-cols-3 gap-3 mt-3">
				<div class="flex items-center gap-2 p-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="size-3.5 rounded-full {instruments.safety.estop_ok ? 'bg-[#2e9e4f]' : 'bg-[#ef4444]'}"></span>
					<div class="flex flex-col">
						<span class="text-xs font-bold text-[#1b2028]">E-Stop KS1</span>
						<span class="text-[11px] text-[#64748b]">{instruments.safety.estop_ok ? 'Healthy' : 'Actuated'}</span>
					</div>
				</div>
				<div class="flex items-center gap-2 p-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="size-3.5 rounded-full {instruments.safety.curtain_ok ? 'bg-[#2e9e4f]' : 'bg-[#ef4444]'}"></span>
					<div class="flex flex-col">
						<span class="text-xs font-bold text-[#1b2028]">Curtain KS2</span>
						<span class="text-[11px] text-[#64748b]">{instruments.safety.curtain_ok ? 'Clear' : 'Interrupted'}</span>
					</div>
				</div>
				<div class="flex items-center gap-2 p-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
					<span class="size-3.5 rounded-full {instruments.safety.km1_ok ? 'bg-[#2e9e4f]' : 'bg-[#ef4444]'}"></span>
					<div class="flex flex-col">
						<span class="text-xs font-bold text-[#1b2028]">KM1 Contactor</span>
						<span class="text-[11px] text-[#64748b]">{instruments.safety.km1_ok ? 'Energized' : 'Open'}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- VFD Speed Control -->
		<div class="flex flex-col p-4 rounded-[12px] bg-white border border-[#c3c8cf] shadow-sm">
			<div class="flex items-center justify-between pb-3 border-b border-[#e0e3e8]">
				<div class="flex items-center gap-2">
					<div class="flex size-9 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#475569]">
						<Sliders class="size-5" />
					</div>
					<div>
						<h3 class="m-0 text-base font-bold text-[#1b2028]">VFD 40HP Drive Control</h3>
						<span class="text-xs text-[#7d848c]">0–10V Speed Signal · 0–50.0 Hz</span>
					</div>
				</div>
				<span class="px-2.5 py-1 rounded text-xs font-bold {instruments.safety.vfd_fault ? 'bg-[#fee2e2] text-[#b91c1c]' : instruments.safety.vfd_running ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]'}">
					{instruments.safety.vfd_fault ? 'FAULT' : instruments.safety.vfd_running ? 'RUNNING' : 'STOPPED'}
				</span>
			</div>

			<div class="flex items-center gap-3 mt-3">
				<span class="text-xs font-bold text-[#475569]">Quick Speed:</span>
				<div class="flex items-center gap-2 flex-1">
					{#each [0, 2.5, 5.0, 7.5, 10.0] as preset}
						<button
							type="button"
							class="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#c3c8cf] bg-[#f8fafc] hover:bg-[#fff2e8] hover:border-[#f26b2a] transition-all disabled:opacity-50"
							{disabled}
							onclick={() => applySpeed(preset)}
						>
							{preset}V ({(preset * 5).toFixed(0)}Hz)
						</button>
					{/each}
				</div>
			</div>

			<div class="flex items-center gap-3 mt-3">
				<input
					type="range"
					min="0"
					max="10"
					step="0.1"
					class="flex-1 accent-[#f26b2a]"
					bind:value={customSpeedV}
					onchange={() => applySpeed(customSpeedV)}
					{disabled}
				/>
				<span class="text-base font-extrabold text-[#1b2028] min-w-[70px] text-right">
					{customSpeedV.toFixed(1)} V
				</span>
			</div>
		</div>
	</div>
</div>

