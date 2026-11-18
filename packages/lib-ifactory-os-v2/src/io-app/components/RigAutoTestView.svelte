<script lang="ts">
	import {
		rigState,
		lastRigRecord,
		scanRigPump,
		startRigTest,
		submitRigUvLeak,
		submitRigDefectCode,
		confirmRigUnload,
		abortRigTest,
		resetRigFault,
		setRigMode,
		setRigOperator
	} from '../lib/io-store.svelte.js';
	import {
		Gauge,
		Activity,
		RotateCw,
		Thermometer,
		Zap,
		ShieldCheck,
		ShieldAlert,
		AlertTriangle,
		CheckCircle2,
		XCircle,
		Play,
		Square,
		RefreshCw,
		ScanLine,
		Sparkles,
		Flame,
		Timer,
		Check,
		X,
		ArrowRight
	} from '@lucide/svelte';
	import { HmiFlatButton } from '@ifactory/ui-v2';

	let barcodeInput = $state('');
	let operatorInput = $state(rigState.operator || 'OP-01');
	let shiftInput = $state(rigState.shift || 'Shift-A');
	let pumpMountedChecked = $state(false);
	let selectedDefectCode = $state('01');
	let defectNote = $state('');

	const DEFECT_CODES = [
		{ code: '01', label: 'Flow less than min limit' },
		{ code: '02', label: 'Pressure not reached / relief low' },
		{ code: '03', label: 'Volumetric efficiency low (<96%)' },
		{ code: '04', label: 'External oil leakage (UV light)' },
		{ code: '05', label: 'Excessive noise / vibration' },
		{ code: '06', label: 'Shaft stiffness / adaptor jam' },
		{ code: '07', label: 'Port thread / flange damage' },
		{ code: '08', label: 'Over-temperature / oil aeration' }
	];

	const SEQUENCE_STEPS = [
		{ name: 'INIT', label: 'Init' },
		{ name: 'IDLE', label: 'Ready' },
		{ name: 'SCAN_LOAD', label: 'Scan' },
		{ name: 'PRECHECK', label: 'Precheck' },
		{ name: 'MOTOR_START', label: 'Motor' },
		{ name: 'CUTTING_IN', label: 'Cut-in' },
		{ name: 'SHOCK', label: 'Shock' },
		{ name: 'CALIBRATION', label: 'Calib' },
		{ name: 'LEAK_CHECK', label: 'UV Leak' },
		{ name: 'FLUSH', label: 'Flush' },
		{ name: 'MOTOR_STOP', label: 'Stop' },
		{ name: 'EVALUATE', label: 'Evaluate' },
		{ name: 'PASS_PUNCH', label: 'Punch' },
		{ name: 'SAVE_RECORD', label: 'Save' },
		{ name: 'UNLOAD', label: 'Unload' }
	];

	function handleScanSubmit(e?: Event) {
		e?.preventDefault();
		if (!barcodeInput.trim()) return;
		scanRigPump(barcodeInput.trim());
		barcodeInput = '';
	}

	function handleQuickSampleScan(sampleCode: string) {
		scanRigPump(sampleCode);
	}

	function handleUpdateOperator() {
		setRigOperator(operatorInput.trim(), shiftInput.trim());
	}

	const stateColor = $derived(() => {
		switch (rigState.state) {
			case 'SAFETY_STOP':
			case 'FAULT':
			case 'ABORT':
				return 'bg-[#ff5a4f] text-white';
			case 'FAIL_DEFECT':
				return 'bg-[#ff7d00] text-white';
			case 'PASS_PUNCH':
				return 'bg-[#2e9e4f] text-white';
			case 'IDLE':
			case 'PRECHECK':
			case 'LEAK_CHECK':
			case 'UNLOAD':
				return 'bg-[#f26b2a] text-white';
			case 'MANUAL':
				return 'bg-[#7c3aed] text-white';
			default:
				return 'bg-[#1b2028] text-white';
		}
	});

	const isSingleCircuit = $derived(rigState.model?.circuit === 'single');
</script>

<div class="flex flex-col gap-4 font-body pb-6 select-none">
	<!-- TOP STATUS & CONTROL HEADER -->
	<div class="flex items-center justify-between p-4 rounded-xl bg-white border border-[#c3c8cf] shadow-sm">
		<div class="flex items-center gap-3">
			<div class="px-4 py-2 rounded-lg font-bold text-lg tracking-wide flex items-center gap-2 {stateColor()}">
				{#if rigState.state === 'SAFETY_STOP' || rigState.state === 'FAULT'}
					<AlertTriangle class="size-5 animate-pulse" />
				{:else if rigState.state === 'PASS_PUNCH'}
					<CheckCircle2 class="size-5" />
				{:else if rigState.state === 'CUTTING_IN' || rigState.state === 'CALIBRATION' || rigState.state === 'SHOCK'}
					<Activity class="size-5 animate-spin" />
				{:else}
					<Gauge class="size-5" />
				{/if}
				<span>{rigState.stateIndex}. {rigState.state}</span>
			</div>

			<div class="flex flex-col border-l border-[#e0e3e8] pl-3">
				<div class="flex items-center gap-2">
					<span class="text-sm font-bold text-[#1b2028]">
						{rigState.model ? rigState.model.partNo : 'No Model Loaded'}
					</span>
					{#if rigState.model}
						<span class="text-xs px-2 py-0.5 rounded bg-[#f0f2f5] font-semibold text-[#5a616c]">
							{rigState.model.circuit.toUpperCase()} · {rigState.model.rotation}
						</span>
					{/if}
				</div>
				<span class="text-xs text-[#7d848c]">
					{rigState.model ? rigState.model.description : 'Scan barcode or select model to begin'}
				</span>
			</div>
		</div>

		<!-- Middle: Active Serial & Operator -->
		<div class="flex items-center gap-4 text-xs font-semibold text-[#5a616c]">
			<div class="flex flex-col">
				<span class="text-[10px] text-[#7d848c] uppercase">Serial No.</span>
				<span class="font-mono font-bold text-[#1b2028] text-sm">
					{rigState.serial || '—'}
				</span>
			</div>
			<div class="h-6 w-px bg-[#e0e3e8]"></div>
			<div class="flex flex-col">
				<span class="text-[10px] text-[#7d848c] uppercase">Operator / Shift</span>
				<span class="font-bold text-[#1b2028]">
					{rigState.operator} · {rigState.shift}
				</span>
			</div>
		</div>

		<!-- Right: Mode & Abort Button -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="px-3 py-2 rounded-lg text-xs font-bold border transition-colors {rigState.mode === 'AUTO'
					? 'bg-[#1b2028] text-white border-[#1b2028]'
					: 'bg-white text-[#5a616c] border-[#c3c8cf]'}"
				onclick={() => setRigMode('AUTO')}
			>
				AUTO
			</button>
			<button
				type="button"
				class="px-3 py-2 rounded-lg text-xs font-bold border transition-colors {rigState.mode === 'MANUAL'
					? 'bg-[#7c3aed] text-white border-[#7c3aed]'
					: 'bg-white text-[#5a616c] border-[#c3c8cf]'}"
				onclick={() => setRigMode('MANUAL')}
			>
				MANUAL
			</button>

			<button
				type="button"
				class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-[#e0564c] border-2 border-[#e0564c] hover:bg-[#fff2f0] transition-colors active:scale-95"
				onclick={() => abortRigTest('Operator HMI Abort button')}
			>
				<Square class="size-4 fill-current" />
				<span>ABORT TEST</span>
			</button>
		</div>
	</div>

	<!-- SEQUENCE STEPPER BAR -->
	<div class="p-3 rounded-xl bg-white border border-[#c3c8cf] shadow-sm overflow-x-auto">
		<div class="flex items-center min-w-[760px] justify-between gap-1">
			{#each SEQUENCE_STEPS as step, idx}
				{@const isCurrent = rigState.state === step.name}
				{@const isPast = rigState.stateIndex > idx && rigState.state !== 'SAFETY_STOP' && rigState.state !== 'FAULT'}
				<div class="flex items-center gap-1 flex-1">
					<div class="flex flex-col items-center flex-1">
						<div
							class="size-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 {isCurrent
								? 'bg-[#f26b2a] text-white ring-4 ring-[#ffe8d6] scale-110'
								: isPast
									? 'bg-[#2e9e4f] text-white'
									: 'bg-[#f0f2f5] text-[#8a9199]'}"
						>
							{#if isPast}
								<Check class="size-3.5" strokeWidth={3} />
							{:else}
								{idx}
							{/if}
						</div>
						<span class="text-[10px] mt-1 font-semibold {isCurrent ? 'text-[#f26b2a] font-bold' : isPast ? 'text-[#2e9e4f]' : 'text-[#8a9199]'} whitespace-nowrap">
							{step.label}
						</span>
					</div>
					{#if idx < SEQUENCE_STEPS.length - 1}
						<div class="h-0.5 flex-1 {isPast ? 'bg-[#2e9e4f]' : 'bg-[#e0e3e8]'}"></div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- MAIN WORKSPACE: GAUGES & ACTIVE ACTION -->
	<div class="grid grid-cols-12 gap-4">
		<!-- LEFT: LIVE GAUGES & METRICS (7 Cols) -->
		<div class="col-span-7 flex flex-col gap-3">
			<!-- Row 1: Pressures -->
			<div class="grid grid-cols-2 gap-3">
				<!-- Front Pressure -->
				<div class="p-4 rounded-xl bg-white border border-[#c3c8cf] shadow-sm flex flex-col justify-between">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold text-[#7d848c] uppercase">Front Pressure</span>
						<span class="text-xs font-semibold px-2 py-0.5 rounded bg-[#fff2e8] text-[#f26b2a]">
							Target: {rigState.model?.frontTestPressure ?? 180} bar
						</span>
					</div>
					<div class="my-2 flex items-baseline gap-2">
						<span class="text-4xl font-extrabold text-[#1b2028]">
							{rigState.readings.pFront.toFixed(1)}
						</span>
						<span class="text-lg font-bold text-[#7d848c]">bar</span>
					</div>
					<div class="w-full bg-[#f0f2f5] rounded-full h-2">
						<div
							class="bg-[#f26b2a] h-2 rounded-full transition-all duration-200"
							style="width: {Math.min(100, (rigState.readings.pFront / 300) * 100)}%"
						></div>
					</div>
				</div>

				<!-- Rear Pressure -->
				<div class="p-4 rounded-xl bg-white border border-[#c3c8cf] shadow-sm flex flex-col justify-between {isSingleCircuit ? 'opacity-40' : ''}">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold text-[#7d848c] uppercase">Rear Pressure</span>
						<span class="text-xs font-semibold px-2 py-0.5 rounded bg-[#f0f2f5] text-[#5a616c]">
							{isSingleCircuit ? 'N/A (Single)' : `Target: ${rigState.model?.rearTestPressure ?? 180} bar`}
						</span>
					</div>
					<div class="my-2 flex items-baseline gap-2">
						<span class="text-4xl font-extrabold text-[#1b2028]">
							{isSingleCircuit ? '—' : rigState.readings.pRear.toFixed(1)}
						</span>
						<span class="text-lg font-bold text-[#7d848c]">bar</span>
					</div>
					<div class="w-full bg-[#f0f2f5] rounded-full h-2">
						<div
							class="bg-[#0284c7] h-2 rounded-full transition-all duration-200"
							style="width: {isSingleCircuit ? 0 : Math.min(100, (rigState.readings.pRear / 300) * 100)}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Row 2: Flow & Volumetric Efficiency -->
			<div class="grid grid-cols-2 gap-3">
				<!-- Front Flow & Volumetric Efficiency -->
				<div class="p-4 rounded-xl bg-white border border-[#c3c8cf] shadow-sm flex flex-col justify-between">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold text-[#7d848c] uppercase">Front Flowmeter</span>
						<span class="text-xs font-semibold text-[#5a616c]">
							Min: {rigState.model?.frontFlowMin ?? 0} LPM
						</span>
					</div>
					<div class="my-2 flex items-baseline justify-between">
						<div class="flex items-baseline gap-1.5">
							<span class="text-3xl font-extrabold text-[#1b2028]">
								{rigState.readings.flowFront.toFixed(2)}
							</span>
							<span class="text-sm font-bold text-[#7d848c]">LPM</span>
						</div>
						<div class="flex flex-col items-end">
							<span class="text-[10px] text-[#7d848c] uppercase">Vol. Eff (ηv)</span>
							<span class="text-lg font-black {rigState.readings.volEffFront !== null && rigState.readings.volEffFront >= 96 ? 'text-[#2e9e4f]' : 'text-[#f26b2a]'}">
								{rigState.readings.volEffFront !== null ? `${rigState.readings.volEffFront.toFixed(1)}%` : '—'}
							</span>
						</div>
					</div>
					<span class="text-[11px] font-semibold text-[#7d848c]">
						Spec threshold: &ge; 96.0% volumetric efficiency
					</span>
				</div>

				<!-- Rear Flow & Volumetric Efficiency -->
				<div class="p-4 rounded-xl bg-white border border-[#c3c8cf] shadow-sm flex flex-col justify-between {isSingleCircuit ? 'opacity-40' : ''}">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold text-[#7d848c] uppercase">Rear Flowmeter</span>
						<span class="text-xs font-semibold text-[#5a616c]">
							Min: {rigState.model?.rearFlowMin ?? 0} LPM
						</span>
					</div>
					<div class="my-2 flex items-baseline justify-between">
						<div class="flex items-baseline gap-1.5">
							<span class="text-3xl font-extrabold text-[#1b2028]">
								{isSingleCircuit ? '—' : rigState.readings.flowRear.toFixed(2)}
							</span>
							<span class="text-sm font-bold text-[#7d848c]">LPM</span>
						</div>
						<div class="flex flex-col items-end">
							<span class="text-[10px] text-[#7d848c] uppercase">Vol. Eff (ηv)</span>
							<span class="text-lg font-black {rigState.readings.volEffRear !== null && rigState.readings.volEffRear >= 96 ? 'text-[#2e9e4f]' : 'text-[#f26b2a]'}">
								{isSingleCircuit ? 'N/A' : rigState.readings.volEffRear !== null ? `${rigState.readings.volEffRear.toFixed(1)}%` : '—'}
							</span>
						</div>
					</div>
					<span class="text-[11px] font-semibold text-[#7d848c]">
						Spec threshold: &ge; 96.0% volumetric efficiency
					</span>
				</div>
			</div>

			<!-- Row 3: RPM, Temp & Energy -->
			<div class="grid grid-cols-3 gap-3">
				<!-- Drive Speed -->
				<div class="p-3 rounded-xl bg-white border border-[#c3c8cf] shadow-sm flex flex-col justify-between">
					<div class="flex items-center gap-1.5 text-xs font-bold text-[#7d848c]">
						<RotateCw class="size-4 text-[#f26b2a]" />
						<span>Speed (RPM)</span>
					</div>
					<div class="my-1 flex items-baseline gap-1.5">
						<span class="text-2xl font-black text-[#1b2028]">
							{rigState.readings.rpm.toFixed(0)}
						</span>
						<span class="text-xs font-bold text-[#7d848c]">rpm</span>
					</div>
					<span class="text-[11px] font-semibold text-[#5a616c]">
						Target: {rigState.model?.speedRpm ?? 1500} &plusmn; 10
					</span>
				</div>

				<!-- Oil Temperature -->
				<div class="p-3 rounded-xl bg-white border border-[#c3c8cf] shadow-sm flex flex-col justify-between">
					<div class="flex items-center gap-1.5 text-xs font-bold text-[#7d848c]">
						<Thermometer class="size-4 text-[#f26b2a]" />
						<span>Oil Temp</span>
					</div>
					<div class="my-1 flex items-baseline gap-1.5">
						<span class="text-2xl font-black text-[#1b2028]">
							{rigState.readings.temp.toFixed(1)}
						</span>
						<span class="text-xs font-bold text-[#7d848c]">&deg;C</span>
					</div>
					<span class="text-[11px] font-semibold {rigState.checklist.oilTempOk ? 'text-[#2e9e4f]' : 'text-[#f26b2a]'}">
						Window: 50 &plusmn; 5 &deg;C
					</span>
				</div>

				<!-- Motor Power -->
				<div class="p-3 rounded-xl bg-white border border-[#c3c8cf] shadow-sm flex flex-col justify-between">
					<div class="flex items-center gap-1.5 text-xs font-bold text-[#7d848c]">
						<Zap class="size-4 text-[#f26b2a]" />
						<span>Drive Power</span>
					</div>
					<div class="my-1 flex items-baseline gap-1.5">
						<span class="text-2xl font-black text-[#1b2028]">
							{rigState.readings.kw.toFixed(1)}
						</span>
						<span class="text-xs font-bold text-[#7d848c]">kW</span>
					</div>
					<span class="text-[11px] font-semibold text-[#5a616c]">
						{rigState.readings.vL1.toFixed(0)} V &middot; {rigState.readings.iL1.toFixed(1)} A
					</span>
				</div>
			</div>
		</div>

		<!-- RIGHT: INTERACTIVE STATE CONTROLS & WORKFLOW (5 Cols) -->
		<div class="col-span-5 flex flex-col">
			<!-- IDLE / SCAN VIEW -->
			{#if rigState.state === 'IDLE' || rigState.state === 'SCAN_LOAD'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border-2 border-[#c3c8cf] shadow-sm">
					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<ScanLine class="size-6 text-[#f26b2a]" />
							<div>
								<h3 class="m-0 text-lg font-bold text-[#1b2028]">Ready for Pump</h3>
								<p class="m-0 text-xs text-[#7d848c]">Scan barcode or enter part number manually</p>
							</div>
						</div>

						<form onsubmit={handleScanSubmit} class="flex flex-col gap-2">
							<label for="barcode-field" class="text-xs font-bold text-[#5a616c]">Scan 2D QR / Barcode</label>
							<div class="flex gap-2">
								<input
									id="barcode-field"
									type="text"
									bind:value={barcodeInput}
									placeholder="e.g. 1040523 or DTL-TG17-1040523-001"
									class="flex-1 px-3 py-2.5 rounded-lg border border-[#c3c8cf] text-sm font-semibold focus:outline-none focus:border-[#f26b2a]"
								/>
								<button
									type="submit"
									class="px-4 py-2.5 rounded-lg bg-[#f26b2a] text-white font-bold text-sm shadow hover:bg-[#e0564c] transition-colors"
								>
									Load
								</button>
							</div>
						</form>

						<!-- Quick test sample recipes -->
						<div class="flex flex-col gap-1.5 mt-2">
							<span class="text-[11px] font-bold text-[#7d848c] uppercase">Quick Select Test Models:</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									class="p-2 rounded-lg border border-[#c3c8cf] bg-[#f9fafb] text-left hover:border-[#f26b2a] text-xs transition-colors"
									onclick={() => handleQuickSampleScan('1040523')}
								>
									<span class="font-bold text-[#1b2028] block">1040523</span>
									<span class="text-[10px] text-[#7d848c]">Tandem · 207 bar CW</span>
								</button>
								<button
									type="button"
									class="p-2 rounded-lg border border-[#c3c8cf] bg-[#f9fafb] text-left hover:border-[#f26b2a] text-xs transition-colors"
									onclick={() => handleQuickSampleScan('1040524')}
								>
									<span class="font-bold text-[#1b2028] block">1040524</span>
									<span class="text-[10px] text-[#7d848c]">Single · 180 bar CW</span>
								</button>
							</div>
						</div>

						<!-- Shift & Operator config -->
						<div class="mt-2 pt-3 border-t border-[#e0e3e8] grid grid-cols-2 gap-2">
							<div>
								<label for="op-id" class="text-[10px] font-bold text-[#7d848c] uppercase block">Operator ID</label>
								<input
									id="op-id"
									type="text"
									bind:value={operatorInput}
									onblur={handleUpdateOperator}
									class="w-full px-2 py-1 text-xs font-semibold rounded border border-[#c3c8cf]"
								/>
							</div>
							<div>
								<label for="shift-id" class="text-[10px] font-bold text-[#7d848c] uppercase block">Shift</label>
								<input
									id="shift-id"
									type="text"
									bind:value={shiftInput}
									onblur={handleUpdateOperator}
									class="w-full px-2 py-1 text-xs font-semibold rounded border border-[#c3c8cf]"
								/>
							</div>
						</div>
					</div>

					<div class="p-3 rounded-lg bg-[#fff2e8] border border-[#fbd2be] text-xs text-[#a34415]">
						Place pump onto the test flange and scan the routing barcode to load the test profile.
					</div>
				</div>

			<!-- PRECHECK VIEW -->
			{:else if rigState.state === 'PRECHECK'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border-2 border-[#f26b2a] shadow-sm">
					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<ShieldCheck class="size-6 text-[#2e9e4f]" />
							<div>
								<h3 class="m-0 text-lg font-bold text-[#1b2028]">Safety & Pre-test Check</h3>
								<p class="m-0 text-xs text-[#7d848c]">Verify rig readiness before motor start</p>
							</div>
						</div>

						<div class="flex flex-col gap-2.5">
							<div class="flex items-center justify-between p-2.5 rounded-lg bg-[#f9fafb] border border-[#e0e3e8]">
								<span class="text-xs font-semibold text-[#1b2028]">Safety Circuit & Light Curtain</span>
								<span class="flex items-center gap-1.5 text-xs font-bold text-[#2e9e4f]">
									<CheckCircle2 class="size-4" /> Healthy
								</span>
							</div>

							<div class="flex items-center justify-between p-2.5 rounded-lg bg-[#f9fafb] border border-[#e0e3e8]">
								<span class="text-xs font-semibold text-[#1b2028]">Punch Cylinder at HOME</span>
								<span class="flex items-center gap-1.5 text-xs font-bold text-[#2e9e4f]">
									<CheckCircle2 class="size-4" /> Confirmed
								</span>
							</div>

							<div class="flex items-center justify-between p-2.5 rounded-lg bg-[#f9fafb] border border-[#e0e3e8]">
								<span class="text-xs font-semibold text-[#1b2028]">Circuit Pressure Zero</span>
								<span class="flex items-center gap-1.5 text-xs font-bold {rigState.readings.pFront < 5 ? 'text-[#2e9e4f]' : 'text-[#f26b2a]'}">
									{#if rigState.readings.pFront < 5}
										<CheckCircle2 class="size-4" /> {rigState.readings.pFront.toFixed(1)} bar
									{:else}
										<XCircle class="size-4" /> Residual: {rigState.readings.pFront.toFixed(1)} bar
									{/if}
								</span>
							</div>

							<div class="flex items-center justify-between p-2.5 rounded-lg bg-[#f9fafb] border border-[#e0e3e8]">
								<span class="text-xs font-semibold text-[#1b2028]">Oil Temperature (45–55 °C)</span>
								<span class="flex items-center gap-1.5 text-xs font-bold {rigState.checklist.oilTempOk ? 'text-[#2e9e4f]' : 'text-[#ff7d00]'}">
									{#if rigState.checklist.oilTempOk}
										<CheckCircle2 class="size-4" /> {rigState.readings.temp.toFixed(1)} &deg;C
									{:else}
										<AlertTriangle class="size-4" /> {rigState.readings.temp.toFixed(1)} &deg;C (Target 50)
									{/if}
								</span>
							</div>

							<!-- Pump Clamped Checkbox -->
							<label class="flex items-center gap-3 p-3 rounded-lg border-2 {pumpMountedChecked ? 'border-[#2e9e4f] bg-[#eefaf2]' : 'border-[#f26b2a] bg-[#fffaf5]'} cursor-pointer">
								<input
									type="checkbox"
									bind:checked={pumpMountedChecked}
									class="size-5 rounded text-[#2e9e4f] focus:ring-[#2e9e4f]"
								/>
								<div class="flex flex-col">
									<span class="text-xs font-bold text-[#1b2028]">Pump Clamped & Adaptor Torqued</span>
									<span class="text-[10px] text-[#7d848c]">Operator physical verification required</span>
								</div>
							</label>
						</div>
					</div>

					<button
						type="button"
						class="w-full py-4 rounded-xl font-black text-lg text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-98 {pumpMountedChecked
							? 'bg-[#2e9e4f] hover:bg-[#258241]'
							: 'bg-[#8a9199] opacity-50 cursor-not-allowed'}"
						disabled={!pumpMountedChecked}
						onclick={() => startRigTest()}
					>
						<Play class="size-5 fill-current" />
						<span>START AUTO TEST</span>
					</button>
				</div>

			<!-- CUTTING IN VIEW -->
			{:else if rigState.state === 'CUTTING_IN'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border border-[#c3c8cf] shadow-sm">
					<div class="flex flex-col gap-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Flame class="size-6 text-[#f26b2a]" />
								<div>
									<h3 class="m-0 text-lg font-bold text-[#1b2028]">Cutting-In Sequence</h3>
									<p class="m-0 text-xs text-[#7d848c]">Gradual pressure bed-in per DTL standard</p>
								</div>
							</div>
							{#if rigState.stage}
								<span class="px-3 py-1 rounded-full bg-[#fff2e8] text-[#f26b2a] text-xs font-black">
									Stage {rigState.stage.current} of {rigState.stage.total}
								</span>
							{/if}
						</div>

						{#if rigState.stage}
							<div class="flex flex-col gap-2 p-4 rounded-xl bg-[#f9fafb] border border-[#e0e3e8]">
								<div class="flex justify-between items-baseline">
									<span class="text-xs font-bold text-[#7d848c] uppercase">Target Pressure</span>
									<span class="text-2xl font-black text-[#1b2028]">{rigState.stage.targetBar} bar</span>
								</div>
								<div class="flex justify-between items-baseline">
									<span class="text-xs font-bold text-[#7d848c] uppercase">Hold Time</span>
									<span class="text-sm font-bold text-[#5a616c]">
										{rigState.stage.elapsedSec.toFixed(1)}s / {rigState.stage.holdSec}s
									</span>
								</div>
								<div class="w-full bg-[#e0e3e8] rounded-full h-2.5 overflow-hidden mt-1">
									<div
										class="bg-[#f26b2a] h-2.5 rounded-full transition-all duration-200"
										style="width: {Math.min(100, (rigState.stage.elapsedSec / rigState.stage.holdSec) * 100)}%"
									></div>
								</div>
							</div>
						{/if}

						<div class="text-xs text-[#5a616c] leading-relaxed">
							Valves switch progressively from SV1 to SV9. Controller monitors for pressure stability &plusmn;5 bar before initiating stage hold.
						</div>
					</div>

					<div class="flex items-center gap-2 text-xs font-bold text-[#7d848c]">
						<Activity class="size-4 animate-spin text-[#f26b2a]" />
						<span>Executing automated pressure stages...</span>
					</div>
				</div>

			<!-- SHOCK VIEW -->
			{:else if rigState.state === 'SHOCK'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border border-[#c3c8cf] shadow-sm">
					<div class="flex flex-col gap-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Zap class="size-6 text-[#7c3aed]" />
								<div>
									<h3 class="m-0 text-lg font-bold text-[#1b2028]">Pressure Shock Cycles</h3>
									<p class="m-0 text-xs text-[#7d848c]">Rapid pressure pulsation (3s ON / 3s OFF)</p>
								</div>
							</div>
							{#if rigState.shock}
								<span class="px-3 py-1 rounded-full bg-[#f3e8ff] text-[#7c3aed] text-xs font-black">
									Shock {rigState.shock.current} of {rigState.shock.total}
								</span>
							{/if}
						</div>

						{#if rigState.shock}
							<div class="p-6 rounded-xl flex flex-col items-center justify-center gap-2 border-2 {rigState.shock.phase === 'ON' ? 'border-[#7c3aed] bg-[#f9f5ff]' : 'border-[#e0e3e8] bg-[#f9fafb]'}">
								<span class="text-xs font-bold text-[#7d848c] uppercase">Current Pulse Phase</span>
								<span class="text-4xl font-black {rigState.shock.phase === 'ON' ? 'text-[#7c3aed]' : 'text-[#8a9199]'}">
									{rigState.shock.phase === 'ON' ? 'HIGH PRESSURE (200 bar)' : 'UNLOAD (0 bar)'}
								</span>
								<span class="text-sm font-bold text-[#5a616c]">
									{rigState.shock.elapsedSec.toFixed(1)}s / 3.0s
								</span>
							</div>
						{/if}
					</div>

					<div class="flex items-center gap-2 text-xs font-bold text-[#7d848c]">
						<Activity class="size-4 animate-spin text-[#7c3aed]" />
						<span>Shock testing pump internal seals & check valves...</span>
					</div>
				</div>

			<!-- CALIBRATION SAMPLING VIEW -->
			{:else if rigState.state === 'CALIBRATION'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border border-[#c3c8cf] shadow-sm">
					<div class="flex flex-col gap-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Activity class="size-6 text-[#0284c7]" />
								<div>
									<h3 class="m-0 text-lg font-bold text-[#1b2028]">Performance Calibration</h3>
									<p class="m-0 text-xs text-[#7d848c]">Holding test pressure & sampling parameters</p>
								</div>
							</div>
							<span class="px-3 py-1 rounded-full bg-[#e0f2fe] text-[#0284c7] text-xs font-black">
								60s Continuous Sample
							</span>
						</div>

						{#if rigState.calibration}
							<div class="flex flex-col gap-3 p-4 rounded-xl bg-[#f0f9ff] border border-[#bae6fd]">
								<div class="flex justify-between items-baseline">
									<span class="text-xs font-bold text-[#0369a1] uppercase">Sampling Progress</span>
									<span class="text-2xl font-black text-[#0369a1]">
										{rigState.calibration.elapsedSec}s / {rigState.calibration.totalSec}s
									</span>
								</div>
								<div class="w-full bg-[#e0f2fe] rounded-full h-3 overflow-hidden">
									<div
										class="bg-[#0284c7] h-3 rounded-full transition-all duration-300"
										style="width: {Math.min(100, (rigState.calibration.elapsedSec / rigState.calibration.totalSec) * 100)}%"
									></div>
								</div>
								<span class="text-[11px] font-semibold text-[#0369a1]">
									Logging flow pulses, pressure stability, and drive kilowatt consumption.
								</span>
							</div>
						{/if}
					</div>

					<div class="flex items-center gap-2 text-xs font-bold text-[#0284c7]">
						<Timer class="size-4 animate-spin" />
						<span>High-accuracy averaging across continuous flow sensor signals...</span>
					</div>
				</div>

			<!-- LEAK CHECK VIEW (OPERATOR INTERACTIVE) -->
			{:else if rigState.state === 'LEAK_CHECK'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border-2 border-[#f26b2a] shadow-md">
					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<Sparkles class="size-6 text-[#f26b2a]" />
							<div>
								<h3 class="m-0 text-lg font-bold text-[#1b2028]">UV Light Leakage Inspection</h3>
								<p class="m-0 text-xs text-[#7d848c]">System holding rated pressure for manual check</p>
							</div>
						</div>

						<div class="p-4 rounded-xl bg-[#fff2e8] border border-[#fbd2be] text-xs leading-relaxed text-[#8a330a]">
							<strong>Inspection Checklist:</strong>
							<ul class="list-disc pl-4 mt-1 space-y-1">
								<li>Turn ON the UV inspection lamp.</li>
								<li>Inspect pump shaft lip seal for oil egress.</li>
								<li>Inspect flange joints, front/rear body seam, and port plugs.</li>
								<li>Fluorescent dye glow indicates high-pressure seal weep.</li>
							</ul>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3 mt-4">
						<button
							type="button"
							class="py-4 px-3 rounded-xl bg-[#2e9e4f] text-white font-black text-sm shadow hover:bg-[#258241] flex flex-col items-center gap-1 transition-transform active:scale-95"
							onclick={() => submitRigUvLeak(true)}
						>
							<CheckCircle2 class="size-6" />
							<span>NO LEAK (PASS)</span>
						</button>

						<button
							type="button"
							class="py-4 px-3 rounded-xl bg-[#e0564c] text-white font-black text-sm shadow hover:bg-[#c93e34] flex flex-col items-center gap-1 transition-transform active:scale-95"
							onclick={() => submitRigUvLeak(false)}
						>
							<XCircle class="size-6" />
							<span>LEAK DETECTED (FAIL)</span>
						</button>
					</div>
				</div>

			<!-- PASS PUNCH VIEW -->
			{:else if rigState.state === 'PASS_PUNCH'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-[#eefaf2] border-2 border-[#2e9e4f] shadow-md">
					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<CheckCircle2 class="size-7 text-[#2e9e4f]" />
							<div>
								<h3 class="m-0 text-xl font-black text-[#1b2028]">TEST PASSED</h3>
								<p class="m-0 text-xs text-[#2e9e4f] font-bold">All parameters conform to DTL/TP/512</p>
							</div>
						</div>

						<div class="p-4 rounded-xl bg-white border border-[#b2e2be] flex flex-col gap-2">
							<span class="text-xs font-bold text-[#5a616c]">Automated Marker Punch (K20):</span>
							<div class="flex items-center gap-2 text-sm font-bold text-[#2e9e4f]">
								<Check class="size-4" strokeWidth={3} />
								<span>Punch extended & retracted successfully</span>
							</div>
							<span class="text-[11px] text-[#7d848c]">Physical inspection mark stamped on pump body</span>
						</div>
					</div>

					<div class="flex items-center gap-2 text-xs font-bold text-[#2e9e4f]">
						<Activity class="size-4 animate-spin" />
						<span>Finalizing digital certificate & local test report...</span>
					</div>
				</div>

			<!-- FAIL DEFECT VIEW (OPERATOR DEFECT ASSIGNMENT) -->
			{:else if rigState.state === 'FAIL_DEFECT'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border-2 border-[#e0564c] shadow-md">
					<div class="flex flex-col gap-3">
						<div class="flex items-center gap-2">
							<XCircle class="size-6 text-[#e0564c]" />
							<div>
								<h3 class="m-0 text-lg font-bold text-[#1b2028]">Test Rejected (FAIL)</h3>
								<p class="m-0 text-xs text-[#7d848c]">Select root cause defect code for ERP record</p>
							</div>
						</div>

						<!-- Failure list -->
						{#if rigState.fault}
							<div class="p-2.5 rounded-lg bg-[#fff2f0] border border-[#f8c8c4] text-xs text-[#b02a24] font-semibold">
								{rigState.fault.message}
							</div>
						{/if}

						<div class="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
							{#each DEFECT_CODES as defect}
								<button
									type="button"
									class="flex items-center justify-between p-2 rounded-lg text-left text-xs font-semibold border transition-colors {selectedDefectCode === defect.code
										? 'border-[#e0564c] bg-[#fff2f0] text-[#b02a24]'
										: 'border-[#e0e3e8] bg-white text-[#5a616c] hover:bg-[#f9fafb]'}"
									onclick={() => (selectedDefectCode = defect.code)}
								>
									<span><strong>{defect.code}</strong> &middot; {defect.label}</span>
									{#if selectedDefectCode === defect.code}
										<Check class="size-4 text-[#e0564c]" />
									{/if}
								</button>
							{/each}
						</div>
					</div>

					<button
						type="button"
						class="w-full py-3.5 rounded-xl bg-[#e0564c] hover:bg-[#c93e34] text-white font-bold text-sm shadow transition-colors"
						onclick={() => submitRigDefectCode(selectedDefectCode, defectNote)}
					>
						Confirm Defect & Save Record
					</button>
				</div>

			<!-- UNLOAD VIEW -->
			{:else if rigState.state === 'UNLOAD'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border-2 border-[#f26b2a] shadow-md">
					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<ArrowRight class="size-6 text-[#f26b2a]" />
							<div>
								<h3 class="m-0 text-lg font-bold text-[#1b2028]">Unload Tested Pump</h3>
								<p class="m-0 text-xs text-[#7d848c]">Circuit depressurised (0 bar). Safe to unclamp.</p>
							</div>
						</div>

						<div class="p-4 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] flex flex-col gap-2 text-xs text-[#0369a1]">
							<span class="font-bold">Summary of Completed Test:</span>
							<span>Result: <strong>{rigState.lastResult ?? 'DONE'}</strong></span>
							<span>Part: {rigState.model?.partNo} (SN: {rigState.serial})</span>
							<span>Record logged to local storage & MQTT bus.</span>
						</div>
					</div>

					<button
						type="button"
						class="w-full py-4 rounded-xl bg-[#f26b2a] hover:bg-[#e0564c] text-white font-black text-base shadow-lg transition-transform active:scale-98"
						onclick={() => confirmRigUnload()}
					>
						CONFIRM PUMP UNLOADED &rarr; READY
					</button>
				</div>

			<!-- SAFETY STOP / FAULT VIEW -->
			{:else if rigState.state === 'SAFETY_STOP' || rigState.state === 'FAULT' || rigState.state === 'ABORT'}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-[#fff2f0] border-2 border-[#ff5a4f] shadow-md">
					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<AlertTriangle class="size-7 text-[#ff5a4f]" />
							<div>
								<h3 class="m-0 text-xl font-black text-[#b02a24]">
									{rigState.state === 'SAFETY_STOP' ? 'SAFETY INTERLOCK STOP' : rigState.state === 'FAULT' ? 'SYSTEM FAULT' : 'TEST ABORTED'}
								</h3>
								<p class="m-0 text-xs text-[#b02a24] font-semibold">Immediate motor cut & valve depressurisation executed</p>
							</div>
						</div>

						<div class="p-4 rounded-xl bg-white border border-[#f8c8c4] flex flex-col gap-1.5 text-xs text-[#1b2028]">
							<span class="font-bold text-[#b02a24]">Cause / Alert:</span>
							<p class="m-0 font-semibold">{rigState.fault?.message || 'Emergency trigger received'}</p>
							{#if rigState.fault?.code}
								<span class="text-[11px] font-mono text-[#7d848c]">Code: {rigState.fault.code}</span>
							{/if}
						</div>

						<div class="text-xs text-[#5a616c]">
							Ensure E-Stop is released, light curtain is clear, and pump circuit is depressurised before resetting.
						</div>
					</div>

					<button
						type="button"
						class="w-full py-4 rounded-xl bg-[#1b2028] hover:bg-[#2d3239] text-white font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-98"
						onclick={() => resetRigFault()}
					>
						<RefreshCw class="size-5" />
						<span>RESET FAULT & RETURN TO IDLE</span>
					</button>
				</div>

			<!-- DEFAULT / RUNNING MOTOR / FLUSH VIEW -->
			{:else}
				<div class="flex flex-col h-full justify-between p-5 rounded-xl bg-white border border-[#c3c8cf] shadow-sm">
					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<Activity class="size-6 text-[#f26b2a]" />
							<div>
								<h3 class="m-0 text-lg font-bold text-[#1b2028]">{rigState.state}</h3>
								<p class="m-0 text-xs text-[#7d848c]">Automated test phase active</p>
							</div>
						</div>

						{#if rigState.flush}
							<div class="p-4 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] flex flex-col gap-2">
								<div class="flex justify-between items-baseline">
									<span class="text-xs font-bold text-[#0369a1] uppercase">Flush Timer (0 bar)</span>
									<span class="text-xl font-black text-[#0369a1]">
										{rigState.flush.elapsedSec}s / {rigState.flush.totalSec}s
									</span>
								</div>
								<div class="w-full bg-[#e0f2fe] rounded-full h-2.5 overflow-hidden">
									<div
										class="bg-[#0284c7] h-2.5 rounded-full transition-all duration-300"
										style="width: {Math.min(100, (rigState.flush.elapsedSec / rigState.flush.totalSec) * 100)}%"
									></div>
								</div>
							</div>
						{/if}
					</div>

					<div class="flex items-center gap-2 text-xs font-bold text-[#7d848c]">
						<Activity class="size-4 animate-spin text-[#f26b2a]" />
						<span>Executing automated sequence...</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
