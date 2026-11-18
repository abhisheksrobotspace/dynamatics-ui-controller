<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Check } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import { resolveProgressBarStepColors, type ProgressBarColorConfig } from './progress-bar.colors';
	import {
		defaultBulletsSteps,
		defaultCirclesSteps,
		defaultCirclesWithTextSteps,
		defaultPanelsSteps,
		type ProgressBarAlign,
		type ProgressBarButtonPlacement,
		type ProgressBarLabelPlacement,
		type ProgressBarStep,
		type ProgressBarVariant
	} from './progress-bar.constants';
	import {
		progressBarBulletsListClass,
		progressBarBulletsNavClass,
		progressBarCirclesCheckIconClass,
		progressBarCirclesConnectorClass,
		progressBarCirclesConnectorShellClass,
		progressBarCirclesHorizontalConnectorClass,
		progressBarCirclesDotClass,
		progressBarCirclesInlineConnectorClass,
		progressBarCirclesItemClass,
		progressBarCirclesLabeledIconCompleteClass,
		progressBarCirclesLabeledIconCurrentClass,
		progressBarCirclesLabeledIconRowClass,
		progressBarCirclesLabeledIconUpcomingClass,
		progressBarCirclesLabeledStepClass,
		progressBarCirclesVerticalButtonRowClass,
		progressBarCirclesVerticalContentClass,
		progressBarCirclesVerticalStepTriggerClass,
		progressBarCirclesVerticalTextColumnClass,
		progressBarCirclesListClass,
		progressBarCirclesNumberedStepClass,
		progressBarCirclesStepCompleteClass,
		progressBarCirclesStepCurrentClass,
		progressBarCirclesStepUpcomingClass,
		progressBarCirclesUpcomingDotClass,
		progressBarNavClass,
		progressBarPanelsIndicatorClass,
		progressBarPanelsItemClass,
		progressBarPanelsListClass,
		progressBarPanelsOuterClass,
		progressBarPanelsSeparatorClass,
		progressBarPanelsSeparatorIconClass,
		progressBarPanelsStepShellClass,
		progressBarPanelsVerticalBodyClass,
		progressBarPanelsVerticalButtonRowClass,
		progressBarPanelsVerticalClickableRowClass,
		progressBarPanelsVerticalContentClass,
		progressBarPanelsVerticalStepTriggerClass
	} from './progress-bar.styles';
	import ProgressBarBulletsStepContent from './progress-bar-bullets-step-content.svelte';
	import ProgressBarCirclesHorizontalIcon from './progress-bar-circles-horizontal-icon.svelte';
	import ProgressBarCirclesHorizontalInlineStep from './progress-bar-circles-horizontal-inline-step.svelte';
	import ProgressBarCirclesHorizontalLabeledStep from './progress-bar-circles-horizontal-labeled-step.svelte';
	import ProgressBarCirclesLabeledContent from './progress-bar-circles-labeled-content.svelte';
	import ProgressBarCirclesLabeledText from './progress-bar-circles-labeled-text.svelte';
	import ProgressBarPanelsHorizontalContent from './progress-bar-panels-horizontal-content.svelte';
	import ProgressBarPanelsStepIconText from './progress-bar-panels-step-icon-text.svelte';
	import {
		defaultStepButtonAction,
		progressBarStepStaticClass,
		resolveActiveIndex,
		shouldShowVerticalStepButton,
		stepStatus,
		stepValue,
		verticalStepButtonLabel,
		verticalStepButtonVariant,
		type ProgressBarStepButtonPayload,
		type ProgressBarStepStatus
	} from './progress-bar.utils';

	type Props = {
		items?: ProgressBarStep[];
		value?: string;
		variant?: ProgressBarVariant;
		align?: ProgressBarAlign;
		showButton?: boolean;
		buttonPlacement?: ProgressBarButtonPlacement;
		buttonLabel?: string;
		buttonVariant?: 'primary' | 'outline' | 'ghost';
		showStepIndicator?: boolean;
		showLabels?: boolean;
		labelPlacement?: ProgressBarLabelPlacement;
		ariaLabel?: string;
		class?: string;
		navClass?: string;
		verticalBodyClass?: string;
		verticalStepTriggerClass?: string;
		verticalTextClass?: string;
		buttonRowClass?: string;
		interactive?: boolean;
		advanceOnButtonClick?: boolean;
		colors?: ProgressBarColorConfig;
		onValueChange?: (value: string) => void;
		onStepButtonClick?: (payload: ProgressBarStepButtonPayload) => void;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		items,
		value = $bindable(''),
		variant = 'panels',
		align = 'horizontal',
		showButton = false,
		buttonPlacement = 'below',
		buttonLabel = 'Continue',
		buttonVariant,
		showStepIndicator = true,
		showLabels = false,
		labelPlacement = 'below',
		ariaLabel = 'Progress',
		class: className = '',
		navClass = '',
		verticalBodyClass = '',
		verticalStepTriggerClass = '',
		verticalTextClass = '',
		buttonRowClass = '',
		interactive = true,
		advanceOnButtonClick = true,
		colors = {},
		onValueChange,
		onStepButtonClick,
		...rest
	}: Props = $props();

	const resolvedItems = $derived.by(() => {
		if (items && items.length > 0) {
			return items;
		}

		if (variant === 'circles') {
			return align === 'vertical' ? defaultCirclesWithTextSteps : defaultCirclesSteps;
		}

		if (variant === 'bullets') {
			return defaultBulletsSteps;
		}

		return defaultPanelsSteps;
	});

	const activeValue = $derived.by(() => {
		if (value) {
			return value;
		}

		const currentItem = resolvedItems.find((item) => item.current);
		if (currentItem) {
			return stepValue(currentItem, resolvedItems.indexOf(currentItem));
		}

		const first = resolvedItems[0];
		return first ? stepValue(first, 0) : '';
	});

	const activeIndex = $derived(resolveActiveIndex(resolvedItems, value || activeValue));

	function setValue(next: string) {
		value = next;
		onValueChange?.(next);
	}

	function handleStepSelect(step: ProgressBarStep, index: number, event?: MouseEvent) {
		if (!interactive) {
			event?.preventDefault();
			return;
		}

		setValue(stepValue(step, index));
		step.onclick?.();

		if (!step.href) {
			event?.preventDefault();
		}
	}

	function stepClickHandler(step: ProgressBarStep, index: number): (event: MouseEvent) => void {
		return (event) => handleStepSelect(step, index, event);
	}

	function stepKeydownHandler(
		step: ProgressBarStep,
		index: number
	): (event: KeyboardEvent) => void {
		return (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return;
			}

			event.preventDefault();
			handleStepSelect(step, index);
		};
	}

	function stepTriggerClass(...classes: Array<string | false | undefined>) {
		return cn(classes, !interactive && progressBarStepStaticClass);
	}

	function handleStepButtonClick(
		step: ProgressBarStep,
		index: number,
		status: ProgressBarStepStatus,
		event: MouseEvent
	) {
		event.stopPropagation();

		if (step.buttonDisabled || (status === 'upcoming' && advanceOnButtonClick)) {
			return;
		}

		if (step.onButtonClick) {
			step.onButtonClick();
		} else if (advanceOnButtonClick) {
			const nextValue = defaultStepButtonAction(resolvedItems, index, status);
			if (nextValue) {
				setValue(nextValue);
			}
		}

		onStepButtonClick?.({
			step,
			index,
			status,
			value: stepValue(step, index)
		});
	}

	function statusFor(index: number): ProgressBarStepStatus {
		const step = resolvedItems[index];
		if (step?.status) {
			return step.status;
		}
		return stepStatus(index, activeIndex);
	}

	function stepButtonVariant(status: ProgressBarStepStatus): 'primary' | 'outline' | 'ghost' {
		return buttonVariant ?? verticalStepButtonVariant(status);
	}

	function circlesStepClass(
		status: ProgressBarStepStatus,
		stepColors: ReturnType<typeof resolveProgressBarStepColors>
	): string {
		if (showStepIndicator && showLabels && labelPlacement === 'beside') {
			return stepTriggerClass(progressBarCirclesNumberedStepClass(status, stepColors, interactive));
		}

		return stepTriggerClass(
			cn({
				[progressBarCirclesStepCompleteClass(stepColors, interactive)]: status === 'complete',
				[progressBarCirclesStepCurrentClass(stepColors)]: status === 'current',
				[progressBarCirclesStepUpcomingClass(stepColors, interactive)]: status === 'upcoming'
			})
		);
	}

	const isInlineLabeled = $derived(
		align === 'horizontal' && showLabels && labelPlacement === 'beside'
	);

	function stepAriaCurrent(status: ProgressBarStepStatus) {
		return status === 'current' ? 'step' : undefined;
	}
</script>

{#if variant === 'panels'}
	<div class={cn(progressBarPanelsOuterClass(align), className)} {...rest}>
		<nav aria-label={ariaLabel} class={cn(progressBarNavClass(variant), navClass)}>
			<ol role="list" class={progressBarPanelsListClass(align)}>
				{#each resolvedItems as step, index (stepValue(step, index))}
					{@const status = statusFor(index)}
					{@const stepColors = resolveProgressBarStepColors(status, step, colors)}
					{@const panelsVerticalTriggerClass = stepTriggerClass(
						progressBarPanelsVerticalStepTriggerClass(buttonPlacement, Boolean(step.description)),
						verticalStepTriggerClass
					)}
					<li class={progressBarPanelsItemClass(align)}>
						<div class={progressBarPanelsStepShellClass(index, resolvedItems.length, align)}>
							{#if align === 'vertical' && showButton}
								{#if showStepIndicator}
									<span
										aria-hidden="true"
										class={progressBarPanelsIndicatorClass(status, align, stepColors)}
									></span>
								{/if}
								{#if interactive}
									{@const panelsVerticalRowClass = cn(
										progressBarPanelsVerticalBodyClass,
										progressBarPanelsVerticalContentClass(buttonPlacement),
										progressBarPanelsVerticalClickableRowClass,
										verticalBodyClass
									)}
									{@const panelsVerticalLabelClass = stepTriggerClass(
										progressBarPanelsVerticalStepTriggerClass(
											buttonPlacement,
											Boolean(step.description)
										),
										verticalStepTriggerClass
									)}
									{#if step.href}
										<a
											class={panelsVerticalRowClass}
											href={step.href}
											aria-current={stepAriaCurrent(status)}
											onclick={stepClickHandler(step, index)}
										>
											<div class={panelsVerticalLabelClass}>
												<ProgressBarPanelsStepIconText {step} {status} {index} {stepColors} />
											</div>
											{#if shouldShowVerticalStepButton(showButton, align, step, status)}
												<div
													class={cn(
														progressBarPanelsVerticalButtonRowClass(buttonPlacement),
														buttonRowClass
													)}
												>
													<Button
														label={verticalStepButtonLabel(step, status, buttonLabel)}
														variant={stepButtonVariant(status)}
														size="sm"
														disabled={step.buttonDisabled ||
															(status === 'upcoming' && advanceOnButtonClick)}
														onclick={(event) => handleStepButtonClick(step, index, status, event)}
													/>
												</div>
											{/if}
										</a>
									{:else}
										<div
											class={panelsVerticalRowClass}
											role="button"
											tabindex="0"
											aria-current={stepAriaCurrent(status)}
											onclick={stepClickHandler(step, index)}
											onkeydown={stepKeydownHandler(step, index)}
										>
											<div class={panelsVerticalLabelClass}>
												<ProgressBarPanelsStepIconText {step} {status} {index} {stepColors} />
											</div>
											{#if shouldShowVerticalStepButton(showButton, align, step, status)}
												<div
													class={cn(
														progressBarPanelsVerticalButtonRowClass(buttonPlacement),
														buttonRowClass
													)}
												>
													<Button
														label={verticalStepButtonLabel(step, status, buttonLabel)}
														variant={stepButtonVariant(status)}
														size="sm"
														disabled={step.buttonDisabled ||
															(status === 'upcoming' && advanceOnButtonClick)}
														onclick={(event) => handleStepButtonClick(step, index, status, event)}
													/>
												</div>
											{/if}
										</div>
									{/if}
								{:else}
									<div class={cn(progressBarPanelsVerticalBodyClass, verticalBodyClass)}>
										<div class={progressBarPanelsVerticalContentClass(buttonPlacement)}>
											<div
												class={panelsVerticalTriggerClass}
												aria-current={stepAriaCurrent(status)}
											>
												<ProgressBarPanelsStepIconText {step} {status} {index} {stepColors} />
											</div>
											{#if shouldShowVerticalStepButton(showButton, align, step, status)}
												<div
													class={cn(
														progressBarPanelsVerticalButtonRowClass(buttonPlacement),
														buttonRowClass
													)}
												>
													<Button
														label={verticalStepButtonLabel(step, status, buttonLabel)}
														variant={stepButtonVariant(status)}
														size="sm"
														disabled={step.buttonDisabled ||
															(status === 'upcoming' && advanceOnButtonClick)}
														onclick={(event) => handleStepButtonClick(step, index, status, event)}
													/>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							{:else}
								{@const panelsTriggerClass = stepTriggerClass('group w-full text-left')}
								{#if interactive && step.href}
									<a
										class={panelsTriggerClass}
										href={step.href}
										aria-current={stepAriaCurrent(status)}
										onclick={stepClickHandler(step, index)}
									>
										<ProgressBarPanelsHorizontalContent
											{step}
											{status}
											{index}
											{align}
											{stepColors}
											{showStepIndicator}
										/>
									</a>
								{:else if interactive}
									<button
										type="button"
										class={panelsTriggerClass}
										aria-current={stepAriaCurrent(status)}
										onclick={stepClickHandler(step, index)}
									>
										<ProgressBarPanelsHorizontalContent
											{step}
											{status}
											{index}
											{align}
											{stepColors}
											{showStepIndicator}
										/>
									</button>
								{:else}
									<div class={panelsTriggerClass} aria-current={stepAriaCurrent(status)}>
										<ProgressBarPanelsHorizontalContent
											{step}
											{status}
											{index}
											{align}
											{stepColors}
											{showStepIndicator}
										/>
									</div>
								{/if}
							{/if}
							{#if align === 'horizontal' && index > 0}
								<div aria-hidden="true" class={progressBarPanelsSeparatorClass(align)}>
									<svg
										viewBox="0 0 12 82"
										fill="none"
										preserveAspectRatio="none"
										class={progressBarPanelsSeparatorIconClass}
									>
										<path
											d="M0.5 0V31L10.5 41L0.5 51V82"
											stroke="currentcolor"
											vector-effect="non-scaling-stroke"
										/>
									</svg>
								</div>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</nav>
	</div>
{:else if variant === 'circles'}
	<div class={className} {...rest}>
		<nav aria-label={ariaLabel} class={cn(progressBarNavClass(variant), navClass)}>
			<ol role="list" class={progressBarCirclesListClass(align, showLabels, labelPlacement)}>
				{#each resolvedItems as step, index (stepValue(step, index))}
					{@const status = statusFor(index)}
					{@const stepColors = resolveProgressBarStepColors(status, step, colors)}
					{@const isLast = index === resolvedItems.length - 1}
					<li class={progressBarCirclesItemClass(isLast, align, showLabels, labelPlacement)}>
						{#if !isLast && !isInlineLabeled}
							{#if align === 'horizontal' && showLabels}
								<div
									aria-hidden="true"
									class={progressBarCirclesHorizontalConnectorClass(stepColors)}
								></div>
							{:else if align === 'horizontal'}
								<div aria-hidden="true" class={progressBarCirclesConnectorShellClass}>
									<div class={progressBarCirclesConnectorClass(align, stepColors)}></div>
								</div>
							{:else}
								<div
									aria-hidden="true"
									class={progressBarCirclesConnectorClass(align, stepColors)}
								></div>
							{/if}
						{/if}
						{#if align === 'horizontal'}
							{@const circlesHorizontalClass = circlesStepClass(status, stepColors)}
							{#if isInlineLabeled}
								{#if interactive && step.href}
									<a
										class="shrink-0"
										href={step.href}
										aria-current={stepAriaCurrent(status)}
										onclick={stepClickHandler(step, index)}
									>
										<ProgressBarCirclesHorizontalInlineStep
											{step}
											{status}
											{index}
											{stepColors}
											circleClass={circlesHorizontalClass}
											{showStepIndicator}
											ariaCurrent={stepAriaCurrent(status)}
										/>
									</a>
								{:else if interactive}
									<button
										type="button"
										class="shrink-0"
										aria-current={stepAriaCurrent(status)}
										onclick={stepClickHandler(step, index)}
									>
										<ProgressBarCirclesHorizontalInlineStep
											{step}
											{status}
											{index}
											{stepColors}
											circleClass={circlesHorizontalClass}
											{showStepIndicator}
											ariaCurrent={stepAriaCurrent(status)}
										/>
									</button>
								{:else}
									<ProgressBarCirclesHorizontalInlineStep
										{step}
										{status}
										{index}
										{stepColors}
										circleClass={circlesHorizontalClass}
										{showStepIndicator}
										ariaCurrent={stepAriaCurrent(status)}
									/>
								{/if}
								{#if !isLast}
									<div
										aria-hidden="true"
										class={progressBarCirclesInlineConnectorClass(stepColors)}
									></div>
								{/if}
							{:else if showLabels}
								{#if interactive && step.href}
									<a
										class="block w-full"
										href={step.href}
										aria-current={stepAriaCurrent(status)}
										onclick={stepClickHandler(step, index)}
									>
										<ProgressBarCirclesHorizontalLabeledStep
											{step}
											{status}
											{stepColors}
											circleClass={circlesHorizontalClass}
											ariaCurrent={stepAriaCurrent(status)}
										/>
									</a>
								{:else if interactive}
									<button
										type="button"
										class="block w-full"
										aria-current={stepAriaCurrent(status)}
										onclick={stepClickHandler(step, index)}
									>
										<ProgressBarCirclesHorizontalLabeledStep
											{step}
											{status}
											{stepColors}
											circleClass={circlesHorizontalClass}
											ariaCurrent={stepAriaCurrent(status)}
										/>
									</button>
								{:else}
									<ProgressBarCirclesHorizontalLabeledStep
										{step}
										{status}
										{stepColors}
										circleClass={circlesHorizontalClass}
										ariaCurrent={stepAriaCurrent(status)}
									/>
								{/if}
							{:else if interactive && step.href}
								<a
									class={circlesHorizontalClass}
									href={step.href}
									aria-current={stepAriaCurrent(status)}
									onclick={stepClickHandler(step, index)}
								>
									<ProgressBarCirclesHorizontalIcon {step} {status} {stepColors} />
								</a>
							{:else if interactive}
								<button
									type="button"
									class={circlesHorizontalClass}
									aria-current={stepAriaCurrent(status)}
									onclick={stepClickHandler(step, index)}
								>
									<ProgressBarCirclesHorizontalIcon {step} {status} {stepColors} />
								</button>
							{:else}
								<div class={circlesHorizontalClass} aria-current={stepAriaCurrent(status)}>
									<ProgressBarCirclesHorizontalIcon {step} {status} {stepColors} />
								</div>
							{/if}
						{:else if showButton}
							{@const circlesVerticalTriggerClass = stepTriggerClass(
								progressBarCirclesVerticalStepTriggerClass(buttonPlacement),
								verticalStepTriggerClass
							)}
							<div class={progressBarCirclesLabeledStepClass}>
								<span aria-hidden="true" class={progressBarCirclesLabeledIconRowClass}>
									{#if status === 'complete'}
										<span
											class={progressBarCirclesLabeledIconCompleteClass(stepColors, interactive)}
										>
											<Check
												class={progressBarCirclesCheckIconClass(stepColors)}
												aria-hidden="true"
											/>
										</span>
									{:else if status === 'current'}
										<span class={progressBarCirclesLabeledIconCurrentClass(stepColors)}>
											<span class={progressBarCirclesDotClass(stepColors)}></span>
										</span>
									{:else}
										<span
											class={progressBarCirclesLabeledIconUpcomingClass(stepColors, interactive)}
										>
											<span class={progressBarCirclesUpcomingDotClass(stepColors)}></span>
										</span>
									{/if}
								</span>
								<span
									class={cn(
										progressBarCirclesVerticalTextColumnClass(buttonPlacement),
										verticalTextClass
									)}
								>
									<div class={progressBarCirclesVerticalContentClass(buttonPlacement)}>
										{#if interactive && step.href}
											<a
												class={circlesVerticalTriggerClass}
												href={step.href}
												aria-current={stepAriaCurrent(status)}
												onclick={stepClickHandler(step, index)}
											>
												<ProgressBarCirclesLabeledText {step} {status} {stepColors} />
											</a>
										{:else if interactive}
											<button
												type="button"
												class={circlesVerticalTriggerClass}
												aria-current={stepAriaCurrent(status)}
												onclick={stepClickHandler(step, index)}
											>
												<ProgressBarCirclesLabeledText {step} {status} {stepColors} />
											</button>
										{:else}
											<div
												class={circlesVerticalTriggerClass}
												aria-current={stepAriaCurrent(status)}
											>
												<ProgressBarCirclesLabeledText {step} {status} {stepColors} />
											</div>
										{/if}
										{#if shouldShowVerticalStepButton(showButton, align, step, status)}
											<div
												class={cn(
													progressBarCirclesVerticalButtonRowClass(buttonPlacement),
													buttonRowClass
												)}
											>
												<Button
													label={verticalStepButtonLabel(step, status, buttonLabel)}
													variant={stepButtonVariant(status)}
													size="sm"
													disabled={step.buttonDisabled ||
														(status === 'upcoming' && advanceOnButtonClick)}
													onclick={(event) => handleStepButtonClick(step, index, status, event)}
												/>
											</div>
										{/if}
									</div>
								</span>
							</div>
						{:else}
							{@const circlesLabeledTriggerClass = stepTriggerClass(
								progressBarCirclesLabeledStepClass,
								'w-full text-left'
							)}
							{#if interactive && step.href}
								<a
									class={circlesLabeledTriggerClass}
									href={step.href}
									aria-current={stepAriaCurrent(status)}
									onclick={stepClickHandler(step, index)}
								>
									<ProgressBarCirclesLabeledContent {step} {status} {stepColors} {interactive} />
								</a>
							{:else if interactive}
								<button
									type="button"
									class={circlesLabeledTriggerClass}
									aria-current={stepAriaCurrent(status)}
									onclick={stepClickHandler(step, index)}
								>
									<ProgressBarCirclesLabeledContent {step} {status} {stepColors} {interactive} />
								</button>
							{:else}
								<div class={circlesLabeledTriggerClass} aria-current={stepAriaCurrent(status)}>
									<ProgressBarCirclesLabeledContent {step} {status} {stepColors} {interactive} />
								</div>
							{/if}
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	</div>
{:else}
	<div class={className} {...rest}>
		<nav aria-label={ariaLabel} class={cn(progressBarBulletsNavClass, navClass)}>
			<ol role="list" class={progressBarBulletsListClass}>
				{#each resolvedItems as step, index (stepValue(step, index))}
					{@const status = statusFor(index)}
					{@const stepColors = resolveProgressBarStepColors(status, step, colors)}
					{@const bulletsTriggerClass = stepTriggerClass(
						'text-left',
						interactive && (status === 'upcoming' || status === 'complete') && 'group'
					)}
					<li>
						{#if interactive && step.href}
							<a
								class={bulletsTriggerClass}
								href={step.href}
								aria-current={stepAriaCurrent(status)}
								onclick={stepClickHandler(step, index)}
							>
								<ProgressBarBulletsStepContent {step} {status} {stepColors} {interactive} />
							</a>
						{:else if interactive}
							<button
								type="button"
								class={bulletsTriggerClass}
								aria-current={stepAriaCurrent(status)}
								onclick={stepClickHandler(step, index)}
							>
								<ProgressBarBulletsStepContent {step} {status} {stepColors} {interactive} />
							</button>
						{:else}
							<div class={bulletsTriggerClass} aria-current={stepAriaCurrent(status)}>
								<ProgressBarBulletsStepContent {step} {status} {stepColors} {interactive} />
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	</div>
{/if}
