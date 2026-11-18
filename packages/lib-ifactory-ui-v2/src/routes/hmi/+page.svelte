<script lang="ts">
	import '@fontsource/space-grotesk/700.css';
	import { Check, CircleX, Pause, Play, RefreshCw, Square, X } from '@lucide/svelte';
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import {
		HmiDataCard,
		HmiButton,
		HmiFlatButton,
		HmiHoldButton,
		HmiKeyboard,
		HmiNumpad,
		HmiSearchSelect,
		type HmiKeyboardLayout
	} from '$lib';

	const jobs = [
		{ value: 'm-121', label: 'M-121 · ISA 75x75x6', meta: '29 Aug · 08:30' },
		{ value: 'm-122', label: 'M-122 · ISA 90x90x8', meta: '29 Aug · 11:00' },
		{ value: 'm-212', label: 'M-212 · ISA 65x65x6', meta: '28 Aug · 14:00' },
		{ value: 'm-305', label: 'M-305 · ISA 50x50x5', meta: '27 Aug · 09:15' }
	];

	let jobId = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);
	let searchSelect = $state<{ commit: () => boolean } | null>(null);

	let text = $state('');
	let textInput = $state<HTMLInputElement | null>(null);
	let layout = $state<HmiKeyboardLayout>('letters');

	let holdLog = $state('Hold END JOB for 1.5 s');
</script>

<DemoBackNav />

<div class="mx-auto max-w-[1280px] space-y-12 p-8">
	<section class="space-y-2">
		<h1 class="text-2xl font-semibold">HMI components</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Touch components for the ioWare 1280×800 HMI (Figma: HMI FROZEN DESIGN). Separate from the
			shared components so the Web OS is unaffected.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HmiSearchSelect + HmiNumpad</h2>
		<div class="flex items-start gap-6">
			<div class="w-[658px] space-y-4">
				<HmiSearchSelect
					bind:this={searchSelect}
					bind:inputRef={searchInput}
					bind:value={jobId}
					items={jobs}
					label="Job ID · Section"
					placeholder="Select a job"
				/>
				<HmiSearchSelect items={[]} label="RM ID" placeholder="Pick a job first" disabled />
				<p class="text-sm text-muted-foreground">Selected: {jobId || '(none)'}</p>
			</div>
			<HmiNumpad
				class="w-[472px]"
				inputElement={searchInput}
				onEnter={() => searchSelect?.commit()}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HmiDataCard</h2>
		<div class="grid w-[658px] grid-cols-2 gap-4">
			<HmiDataCard class="h-[165px]" label="Bars needed" value="24" />
			<HmiDataCard class="h-[165px]" label="Total pieces" value="24" unit="pcs" />
			<HmiDataCard class="h-[165px]" label="End trim" value="60" unit="mm" />
			<HmiDataCard class="h-[165px]" label="RM length" value="7100" unit="mm" />
		</div>
		<div class="w-[472px] space-y-4">
			<HmiDataCard class="h-[137px]" label="Uptime" value="00:42:18" icon={Play} iconTone="go" />
			<HmiDataCard
				class="h-[137px]"
				label="Downtime"
				value="00:03:05"
				icon={Pause}
				iconTone="stop"
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HmiButton</h2>
		<div class="flex flex-wrap items-center gap-6">
			<HmiButton label="Scan" icon={RefreshCw} size="md" />
			<HmiButton icon={X} size="md" aria-label="Close" />
			<HmiButton label="Forget network" icon={X} />
			<HmiButton label="Done" icon={Check} tone="primary" />
			<HmiButton label="Sync now" icon={RefreshCw} loading />
			<HmiButton label="Done" icon={Check} tone="primary" disabled />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HmiFlatButton</h2>
		<div class="grid w-[960px] grid-cols-2 gap-4">
			<HmiFlatButton label="Next RM ID" icon={Check} tone="primary" />
			<HmiFlatButton label="Change job" icon={RefreshCw} />
			<HmiFlatButton label="Edit quantities" icon={RefreshCw} size="md" />
			<HmiFlatButton label="Log out" icon={X} tone="stop" size="md" />
			<HmiFlatButton label="Find mark" icon={RefreshCw} size="xs" />
			<HmiFlatButton label="Clear" icon={X} size="xs" active />
			<HmiFlatButton label="Log out" icon={X} size="md" disabled />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HmiHoldButton</h2>
		<div class="flex items-center gap-6">
			<HmiHoldButton
				class="w-[472px]"
				label="End Job"
				icon={Square}
				onHoldStart={() => (holdLog = 'Holding…')}
				onHoldCancel={() => (holdLog = 'Released early — not confirmed')}
				onConfirm={() => (holdLog = 'Confirmed ✔')}
			/>
			<HmiHoldButton class="w-[472px]" label="End Job" icon={Square} disabled />
		</div>
		<HmiHoldButton
			class="w-[472px]"
			tone="end"
			iconClass="text-[#ff5a4f]"
			label="End Job"
			icon={CircleX}
			hint="Press and hold END JOB for 1.5 s"
			onConfirm={() => (holdLog = 'Confirmed ✔')}
		/>
		<p class="text-sm text-muted-foreground">{holdLog}</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HmiKeyboard</h2>
		<input
			bind:this={textInput}
			bind:value={text}
			inputmode="none"
			class="w-[522px] rounded-lg border-2 border-[#aeb4bd] px-4 py-3 text-2xl"
			placeholder="Type with the keyboard below"
		/>
		<p class="text-sm text-muted-foreground">Layout: {layout} · Value: {text || '(empty)'}</p>
		<div class="w-[1280px]">
			<HmiKeyboard
				inputElement={textInput}
				bind:layout
				doneLabel={layout === 'letters' ? 'NEXT' : 'LOG IN'}
			/>
		</div>
	</section>
</div>
