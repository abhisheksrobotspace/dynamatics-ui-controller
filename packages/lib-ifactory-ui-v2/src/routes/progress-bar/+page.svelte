<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Button, ProgressBar } from '$lib';
	import type { ProgressBarColorConfig, ProgressBarStep } from '$lib/components/ui/progress-bar';
	import {
		nextStepIndex,
		previousStepIndex,
		resolveActiveIndex,
		stepValueAtIndex
	} from '$lib/components/ui/progress-bar/progress-bar.utils';
	import {
		defaultBulletsSteps,
		defaultCirclesSteps,
		defaultCirclesWithTextSteps,
		defaultPanelsSteps
	} from '$lib/components/ui/progress-bar/progress-bar.constants';

	const panelsSteps: ProgressBarStep[] = defaultPanelsSteps;
	const circlesSteps: ProgressBarStep[] = defaultCirclesSteps;
	const circlesWithTextSteps: ProgressBarStep[] = defaultCirclesWithTextSteps;
	const bulletsSteps: ProgressBarStep[] = defaultBulletsSteps;

	let activePanelsStep = $state('application-form');
	let activeCirclesStep = $state('3');
	let activeVerticalCirclesStep = $state('profile');
	let activeVerticalPanelsStep = $state('application-form');
	let activeBulletsStep = $state('profile');
	let controlledPanelsStep = $state('job-details');
	let containerWidth = $state(520);
	let activeColorPanelsStep = $state('application-form');

	const onlineTone: ProgressBarColorConfig = { tone: 'online' };
	const statusTone: ProgressBarColorConfig = {
		complete: 'online',
		current: 'loading',
		upcoming: 'primary'
	};
	const perStepColorPanels: ProgressBarStep[] = [
		{
			label: 'Job Details',
			description: 'Uses online tone.',
			value: 'job-details',
			color: 'online'
		},
		{
			label: 'Application form',
			description: 'Uses loading tone.',
			value: 'application-form',
			current: true,
			color: 'loading'
		},
		{ label: 'Preview', description: 'Uses error tone.', value: 'preview', color: 'error' }
	];

	const controlledPanelsIndex = $derived(resolveActiveIndex(panelsSteps, controlledPanelsStep));
	const canGoPrevious = $derived(previousStepIndex(panelsSteps, controlledPanelsIndex) !== null);
	const canGoNext = $derived(nextStepIndex(panelsSteps, controlledPanelsIndex) !== null);

	function goToPreviousStep() {
		const previousIndex = previousStepIndex(panelsSteps, controlledPanelsIndex);
		if (previousIndex === null) return;
		const previousValue = stepValueAtIndex(panelsSteps, previousIndex);
		if (previousValue) controlledPanelsStep = previousValue;
	}

	function goToNextStep() {
		const nextIndex = nextStepIndex(panelsSteps, controlledPanelsIndex);
		if (nextIndex === null) return;
		const nextValue = stepValueAtIndex(panelsSteps, nextIndex);
		if (nextValue) controlledPanelsStep = nextValue;
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Progress Bar</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Multi-step progress indicators with panels, circles, and bullet variants. Progress is
			controlled through `bind:value`, step action buttons, or parent actions. Colors are
			configurable globally via `colors`, per status, or per step with `color`. Set `interactive={false}`
			to disable step clicks while keeping button-driven or prop-driven updates.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Controlled via props</h2>
		<p class="text-sm text-muted-foreground">
			Active step: {controlledPanelsStep}. Progress updates from parent buttons or `bind:value`
			only.
		</p>
		<div class="space-y-4 rounded-lg border border-border bg-surface p-6">
			<div class="flex flex-wrap gap-2">
				<Button
					label="Previous"
					variant="outline"
					disabled={!canGoPrevious}
					onclick={goToPreviousStep}
				/>
				<Button label="Next" variant="primary" disabled={!canGoNext} onclick={goToNextStep} />
			</div>
			<ProgressBar
				items={panelsSteps}
				bind:value={controlledPanelsStep}
				variant="panels"
				align="vertical"
				showButton
				buttonPlacement="beside"
				interactive={false}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Configurable colors</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Set a global `colors` tone, override per status (`complete`, `current`, `upcoming`), or set
			`color` on individual steps.
		</p>

		<div class="grid gap-6 lg:grid-cols-2">
			<div class="space-y-2 rounded-lg border border-border bg-surface p-6">
				<h3 class="text-sm font-medium">Global tone: online</h3>
				<ProgressBar
					items={panelsSteps}
					bind:value={activeColorPanelsStep}
					variant="panels"
					align="vertical"
					colors={onlineTone}
				/>
			</div>

			<div class="space-y-2 rounded-lg border border-border bg-surface p-6">
				<h3 class="text-sm font-medium">Per-status tones</h3>
				<ProgressBar
					items={panelsSteps}
					bind:value={activeColorPanelsStep}
					variant="circles"
					colors={statusTone}
				/>
			</div>

			<div class="space-y-2 rounded-lg border border-border bg-surface p-6 lg:col-span-2">
				<h3 class="text-sm font-medium">Per-step colors</h3>
				<ProgressBar
					items={perStepColorPanels}
					bind:value={activeColorPanelsStep}
					variant="panels"
					align="vertical"
				/>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<p class="text-sm text-muted-foreground">Active step: {activePanelsStep}</p>
		<div class="rounded-lg border border-border bg-surface">
			<ProgressBar items={panelsSteps} bind:value={activePanelsStep} variant="panels" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Panels — vertical</h2>
		<p class="text-sm text-muted-foreground">Active step: {activePanelsStep}</p>
		<div class="max-w-md rounded-lg border border-border bg-surface">
			<ProgressBar
				items={panelsSteps}
				bind:value={activePanelsStep}
				variant="panels"
				align="vertical"
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Panels — vertical with buttons</h2>
		<p class="text-sm text-muted-foreground">Active step: {activeVerticalPanelsStep}</p>
		<div class="max-w-md rounded-lg border border-border bg-surface">
			<ProgressBar
				items={panelsSteps}
				bind:value={activeVerticalPanelsStep}
				variant="panels"
				align="vertical"
				showButton
				buttonLabel="Continue"
				interactive={false}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Panels — vertical, button beside text</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Drag the slider to change the available width and see how the step rows adapt when space is
			tight.
		</p>
		<p class="text-sm text-muted-foreground">Active step: {activeVerticalPanelsStep}</p>

		<div class="space-y-4 rounded-lg border border-border bg-surface p-6">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<label class="text-sm font-medium text-foreground" for="progress-bar-width">
					Container width
				</label>
				<span class="text-sm text-muted-foreground">{containerWidth}px</span>
			</div>
			<input
				id="progress-bar-width"
				type="range"
				min="280"
				max="960"
				step="10"
				bind:value={containerWidth}
				class="w-full accent-primary"
			/>

			<div
				class="overflow-hidden rounded-md border border-dashed border-border bg-gray-50"
				style:width="{containerWidth}px"
				style:max-width="100%"
			>
				<ProgressBar
					items={panelsSteps}
					bind:value={activeVerticalPanelsStep}
					variant="panels"
					align="vertical"
					showButton
					buttonPlacement="beside"
					interactive={false}
				/>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Circles — horizontal (read-only)</h2>
		<p class="text-sm text-muted-foreground">Active step: {activeCirclesStep}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar
				items={circlesSteps}
				bind:value={activeCirclesStep}
				variant="circles"
				interactive={false}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Circles — horizontal with labels</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Pass <code class="text-foreground">showLabels</code> to render step labels under each circle.
		</p>
		<p class="text-sm text-muted-foreground">Active step: {activeVerticalCirclesStep}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar
				items={circlesWithTextSteps}
				bind:value={activeVerticalCirclesStep}
				variant="circles"
				showLabels
				interactive={false}
				colors={statusTone}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Circles — inline numbered steps</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Use <code class="text-foreground">labelPlacement="beside"</code> and
			<code class="text-foreground">showStepIndicator</code> for numbered circles with labels inline,
			as used in the cutting plan wizard.
		</p>
		<p class="text-sm text-muted-foreground">Active step: sections</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar
				items={[
					{ label: 'Select Sections', value: 'sections' },
					{ label: 'Stock Lengths', value: 'stock-lengths' },
					{ label: 'Run', value: 'run' },
					{ label: 'Results', value: 'results' }
				]}
				value="sections"
				variant="circles"
				showLabels
				labelPlacement="beside"
				showStepIndicator
				interactive={false}
				colors={{ tone: 'primary' }}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Circles — horizontal</h2>
		<p class="text-sm text-muted-foreground">Active step: {activeCirclesStep}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar items={circlesSteps} bind:value={activeCirclesStep} variant="circles" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Circles — vertical</h2>
		<p class="text-sm text-muted-foreground">Active step: {activeVerticalCirclesStep}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar
				items={circlesWithTextSteps}
				bind:value={activeVerticalCirclesStep}
				variant="circles"
				align="vertical"
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Circles — vertical with buttons</h2>
		<p class="text-sm text-muted-foreground">Active step: {activeVerticalCirclesStep}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar
				items={circlesWithTextSteps}
				bind:value={activeVerticalCirclesStep}
				variant="circles"
				align="vertical"
				showButton
				buttonLabel="Save and continue"
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Circles — vertical, button beside text</h2>
		<p class="text-sm text-muted-foreground">Active step: {activeVerticalCirclesStep}</p>
		<div class="max-w-lg rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar
				items={circlesWithTextSteps}
				bind:value={activeVerticalCirclesStep}
				variant="circles"
				align="vertical"
				showButton
				buttonPlacement="beside"
				buttonLabel="Save and continue"
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Bullets and text</h2>
		<p class="text-sm text-muted-foreground">Active step: {activeBulletsStep}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-8">
			<ProgressBar items={bulletsSteps} bind:value={activeBulletsStep} variant="bullets" />
		</div>
	</section>
</div>
