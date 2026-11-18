<script lang="ts">
	import { Button, Dialog, Input, Label } from '@ifactory/ui-v2';
	import { AlertTriangle, Layers } from '@lucide/svelte';
	import type { SectionRule } from '../lib/store.svelte.js';
	import type { RuleDraft } from '../lib/section-rules/rule-draft';
	import {
		formatRuleCoversSectionsFromDraft,
		formatRuleFlangeTitle,
		getProjectRuleIndex
	} from '../lib/section-rules/section-rule-display';
	import {
		canSaveRuleDraft,
		findOverlappingRule,
		formatOverlapMessage,
		getRuleFieldErrors,
		type RuleFieldKey
	} from '../lib/section-rules/section-rule-validation';

	interface Props {
		open?: boolean;
		draft: RuleDraft;
		editingRuleId?: string | null;
		rules: SectionRule[];
		projectId: string;
		onSave?: () => void;
	}

	let {
		open = $bindable(false),
		draft = $bindable(),
		editingRuleId = null,
		rules,
		projectId,
		onSave
	}: Props = $props();

	const fieldErrors = $derived(getRuleFieldErrors(draft));
	const overlap = $derived(findOverlappingRule(draft, rules, projectId, editingRuleId));
	const canSave = $derived(canSaveRuleDraft(draft, rules, projectId, editingRuleId));
	const coversSections = $derived(formatRuleCoversSectionsFromDraft(draft));

	const dialogTitle = $derived.by(() => {
		if (!editingRuleId) return 'Add Rule';

		const ruleIndex = getProjectRuleIndex(rules, projectId, editingRuleId);
		return `Edit Rule ${ruleIndex} - ${formatRuleFlangeTitle(draft.fromFlg, draft.toFlg)}`;
	});

	function fieldError(field: RuleFieldKey): boolean {
		return Boolean(fieldErrors[field]);
	}

	function handleSave() {
		if (!canSave) return;
		onSave?.();
		open = false;
	}

	function handleCancel() {
		open = false;
	}
</script>

<Dialog
	bind:open
	title={dialogTitle}
	size="lg"
	hideFooter
	onConfirm={handleSave}
	class="flex max-h-[90vh] flex-col overflow-hidden"
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
		{#if overlap}
			<div
				class="flex items-start gap-3 rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-foreground"
				role="alert"
			>
				<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
				<p>{formatOverlapMessage(overlap)}</p>
			</div>
		{/if}

		<section class="space-y-4">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Applies to
			</h3>

			<div class="space-y-2">
				<Label text="Flange range (mm)" />
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="fromFlg" text="From" class="text-xs font-normal text-muted-foreground" />
						<div class="relative">
							<Input
								id="fromFlg"
								type="number"
								min="0"
								step="any"
								bind:value={draft.fromFlg}
								autofocus
								class="pr-10"
							/>
							<span
								class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
								>mm</span
							>
						</div>
					</div>
					<div class="space-y-1">
						<Label for="toFlg" text="To" class="text-xs font-normal text-muted-foreground" />
						<div class="relative">
							<Input
								id="toFlg"
								type="number"
								min="0"
								step="any"
								bind:value={draft.toFlg}
								error={fieldError('toFlg')}
								class="pr-10"
							/>
							<span
								class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
								>mm</span
							>
						</div>
					</div>
				</div>
			</div>

			<div class="space-y-2">
				<Label text="Thickness range (mm)" />
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="fromThk" text="From" class="text-xs font-normal text-muted-foreground" />
						<div class="relative">
							<Input
								id="fromThk"
								type="number"
								min="0"
								step="any"
								bind:value={draft.fromThk}
								class="pr-10"
							/>
							<span
								class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
								>mm</span
							>
						</div>
					</div>
					<div class="space-y-1">
						<Label for="toThk" text="To" class="text-xs font-normal text-muted-foreground" />
						<div class="relative">
							<Input
								id="toThk"
								type="number"
								min="0"
								step="any"
								bind:value={draft.toThk}
								error={fieldError('toThk')}
								class="pr-10"
							/>
							<span
								class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
								>mm</span
							>
						</div>
					</div>
				</div>
			</div>

			<div
				class="flex items-center gap-2 rounded-none border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
			>
				<Layers class="size-4 shrink-0" aria-hidden="true" />
				<span>Covers sections {coversSections}</span>
			</div>
		</section>

		<section class="space-y-4">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Stock length output
			</h3>

			<div class="space-y-2">
				<Label text="Stock length range (mm)" />
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="minLength" text="Min" class="text-xs font-normal text-muted-foreground" />
						<div class="relative">
							<Input
								id="minLength"
								type="number"
								min="0"
								step="any"
								bind:value={draft.minLength}
								class="pr-10"
							/>
							<span
								class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
								>mm</span
							>
						</div>
					</div>
					<div class="space-y-1">
						<Label for="maxLength" text="Max" class="text-xs font-normal text-muted-foreground" />
						<div class="relative">
							<Input
								id="maxLength"
								type="number"
								min="0"
								step="any"
								bind:value={draft.maxLength}
								error={fieldError('maxLength')}
								class="pr-10"
							/>
							<span
								class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
								>mm</span
							>
						</div>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="pitch" text="Pitch (mm)" />
					<div class="relative">
						<Input
							id="pitch"
							type="number"
							min="0"
							step="any"
							bind:value={draft.pitch}
							error={fieldError('pitch')}
							class="pr-10"
						/>
						<span
							class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
							>mm</span
						>
					</div>
				</div>
				<div class="space-y-2">
					<Label for="endTrim" text="End trim (mm)" />
					<div class="relative">
						<Input
							id="endTrim"
							type="number"
							min="0"
							step="any"
							bind:value={draft.endTrim}
							class="pr-10"
						/>
						<span
							class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
							>mm</span
						>
					</div>
				</div>
			</div>
		</section>
	</div>

	<div class="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-white px-6 py-4">
		<Button variant="outline" label="Cancel" class="w-full" onclick={handleCancel} />
		<Button
			variant="primary"
			label="Save"
			class="w-full"
			disabled={!canSave}
			onclick={handleSave}
		/>
	</div>
</Dialog>
