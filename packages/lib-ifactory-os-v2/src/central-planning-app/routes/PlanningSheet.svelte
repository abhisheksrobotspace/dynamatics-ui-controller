<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Button,
		Combobox,
		ConfirmationDialog,
		Dialog,
		Label,
		TreeTable,
		collectExpandableIds,
		type ComboboxItem,
		type TreeTableColumnDef,
		type TreeTableNode,
		type TreeTableToolbarButtonConfig
	} from '@ifactory/ui-v2';
	import { Lock, Pencil, Play, Save, Send, Snowflake, Unlock, X } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { reviewInputHash } from '../../aps-app/lib/manufacturing-plans.js';
	import { openOrCreateRequestForShopfloor } from '../../aps-app/lib/schedule-requests.api.js';
	import { resolvePlanningAppData } from '../../rm-indent-app/lib/planning-capabilities';
	import { rmiPushToast } from '../../rm-indent-app/lib/toast';
	import { formatMonthLabel, loadFuturePlanningSheetTree } from '../lib/planning-sheet.load';
	import {
		balanceSets,
		formatSets,
		isMonthIncluded,
		isMonthIndeterminate,
		maxBomMonthQty,
		plannedSetsForMonth,
		planningNodeDelayLabel,
		setBomMonthQty,
		setMonthIncluded
	} from '../lib/planning-sheet.model';
	import {
		clearPendingPlanName,
		clearWorkingDraft,
		createDefaultDraft,
		freezeShopFloorMonth,
		getCarryForward,
		getPendingPlanName,
		getPlanningSheetPlan,
		getWorkingDraft,
		isMonthFrozen,
		loadPlanningSheetPlan,
		registerShopFloorMonthPlan,
		savePlanningSheetPlan,
		sendPlanMonthToShopFloor,
		setWorkingDraft,
		unfreezeShopFloorMonth,
		updatePlanningSheetPlanDraft
	} from '../lib/planning-sheet.store';
	import type { PlanningSheetDraft, PlanningSheetRowData } from '../lib/planning-sheet.types';
	import {
		isShopFloorMonthFrozen,
		loadShopFloorMonthContext,
		loadShopFloorOverlay,
		markShopFloorMonthFrozen,
		markShopFloorMonthUnfrozen,
		saveShopFloorPlanDraft
	} from '../../shop-floor-planning-app/lib/sfp-planning-sheet.store';

	let {
		params = {},
		data,
		readOnly = false,
		/** When true, edits save to Shop Floor overlay storage — CP published plan is untouched. */
		shopFloorLocal = false,
		/** When set (SFP), show only this month column. */
		shopFloorMonth = '',
		/** Extra toolbar actions (e.g. RMI Raise Indent). */
		extraToolbarButtons = [],
		/** Row checkboxes for Stock Assignment → Lock. */
		selectionEnabled = false,
		selectedIds = $bindable<string[]>([])
	}: {
		params?: Record<string, string>;
		data?: unknown;
		readOnly?: boolean;
		shopFloorLocal?: boolean;
		shopFloorMonth?: string;
		extraToolbarButtons?: TreeTableToolbarButtonConfig[];
		selectionEnabled?: boolean;
		selectedIds?: string[];
	} = $props();

	const planId = $derived(params.planId ? decodeURIComponent(params.planId) : 'new');
	const monthParam = $derived(
		shopFloorMonth || (params.month ? decodeURIComponent(params.month) : '') || ''
	);
	/** Bump to refresh store-backed derived UI after mutations. */
	let storeEpoch = $state(0);
	/** Resolved shopfloor_plan_id when viewing/editing a sent month (SFP). */
	let shopfloorPlanId = $state('');
	const planRecord = $derived.by(() => {
		void storeEpoch;
		return planId !== 'new' ? getPlanningSheetPlan(planId) : undefined;
	});
	/** Depends on `storeEpoch` — frozen flags live in non-reactive Maps. */
	const sfpFrozen = $derived.by(() => {
		void storeEpoch;
		if (!shopFloorLocal || !shopfloorPlanId) return false;
		return (
			isShopFloorMonthFrozen(shopfloorPlanId) ||
			(planRecord ? isMonthFrozen(monthParam, planRecord.plantId) : isMonthFrozen(monthParam))
		);
	});
	const isReadOnly = $derived(readOnly || sfpFrozen);

	let isLoading = $state(true);
	let isSaving = $state(false);
	let isEditing = $state(false);
	let treeNodes = $state<TreeTableNode<PlanningSheetRowData>[]>([]);
	let expandedIds = $state<string[]>([]);
	let draft = $state<PlanningSheetDraft>({
		months: [],
		monthQtyByBomId: {},
		included: {}
	});
	/** Snapshot taken when Edit starts — restored on Cancel. */
	let editBaseline: PlanningSheetDraft | null = null;
	let allNodeIds = $state<string[]>([]);
	/** `bomNodeId:month` keys — inputs that already hold qty when user over-allocates. */
	let highlightedQtyKeys = $state<string[]>([]);
	let highlightClearTimer: ReturnType<typeof setTimeout> | null = null;

	let isSendOpen = $state(false);
	let sendMonth = $state('');
	let isFreezeOpen = $state(false);
	let isUnfreezeOpen = $state(false);

	const visibleMonths = $derived(shopFloorLocal && monthParam ? [monthParam] : draft.months);

	const sendMonthItems = $derived.by((): ComboboxItem[] => {
		void storeEpoch;
		const sent: Record<string, true> = {};
		for (const m of planRecord?.sentToShopFloorMonths ?? []) sent[m] = true;
		return (planRecord?.draft.months ?? draft.months)
			.filter((m) => !isMonthFrozen(m))
			.map((m) => ({
				value: m,
				label: sent[m] ? `${formatMonthLabel(m)} (already sent)` : formatMonthLabel(m)
			}));
	});

	function cloneDraftLocal(d: PlanningSheetDraft): PlanningSheetDraft {
		return {
			months: [...d.months],
			monthQtyByBomId: Object.fromEntries(
				Object.entries(d.monthQtyByBomId).map(([id, months]) => [id, { ...months }])
			),
			included: Object.fromEntries(
				Object.entries(d.included).map(([id, months]) => [id, { ...months }])
			)
		};
	}

	function qtyHighlightKey(bomNodeId: string, month: string): string {
		return `${bomNodeId}:${month}`;
	}

	function highlightFilledQtyInputs(bomNodeId: string, exceptMonth: string) {
		const keys: string[] = [];
		for (const m of draft.months) {
			if (m === exceptMonth) continue;
			if ((draft.monthQtyByBomId[bomNodeId]?.[m] ?? 0) > 0) {
				keys.push(qtyHighlightKey(bomNodeId, m));
			}
		}
		if (keys.length === 0) keys.push(qtyHighlightKey(bomNodeId, exceptMonth));
		highlightedQtyKeys = keys;
		if (highlightClearTimer) clearTimeout(highlightClearTimer);
		highlightClearTimer = setTimeout(() => {
			highlightedQtyKeys = [];
			highlightClearTimer = null;
		}, 2800);
	}

	function collectAllNodeIds(nodes: TreeTableNode<PlanningSheetRowData>[]): string[] {
		const ids: string[] = [];
		for (const node of nodes) {
			ids.push(node.id);
			if (node.children?.length) ids.push(...collectAllNodeIds(node.children));
		}
		return ids;
	}

	function sumCarryForward(
		nodes: TreeTableNode<PlanningSheetRowData>[],
		nodeId: string,
		month: string
	): number {
		void storeEpoch;
		if (planId === 'new') return 0;
		const find = (
			list: TreeTableNode<PlanningSheetRowData>[]
		): TreeTableNode<PlanningSheetRowData> | undefined => {
			for (const n of list) {
				if (n.id === nodeId) return n;
				if (n.children?.length) {
					const hit = find(n.children);
					if (hit) return hit;
				}
			}
			return undefined;
		};
		const node = find(nodes);
		if (!node) return 0;
		if (node.data?.kind === 'bom') {
			return getCarryForward(planId, node.id, month);
		}
		let sum = 0;
		for (const child of node.children ?? []) {
			sum += sumCarryForward(nodes, child.id, month);
		}
		return sum;
	}

	function hostAppName(): string {
		return resolvePlanningAppData(data, 'CentralPlanning').appName;
	}

	function startEdit() {
		if (isReadOnly) return;
		editBaseline = cloneDraftLocal(draft);
		isEditing = true;
	}

	function cancelEdit() {
		if (editBaseline) {
			draft = cloneDraftLocal(editBaseline);
			if (!shopFloorLocal) setWorkingDraft(draft);
		}
		editBaseline = null;
		isEditing = false;
		highlightedQtyKeys = [];
		if (highlightClearTimer) {
			clearTimeout(highlightClearTimer);
			highlightClearTimer = null;
		}
	}

	function monthEditable(month: string): boolean {
		if (isMonthFrozen(month, planRecord?.plantId)) return false;
		if (shopFloorLocal && shopfloorPlanId && isShopFloorMonthFrozen(shopfloorPlanId)) return false;
		return true;
	}

	const columns = $derived.by((): TreeTableColumnDef<PlanningSheetRowData>[] => {
		void storeEpoch;
		const totalMt = treeNodes.reduce((sum, node) => sum + (node.data?.qtyMt ?? 0), 0);
		const totalTonnageValue = totalMt > 0 ? `${totalMt.toFixed(3)} MT` : '—';

		const base: TreeTableColumnDef<PlanningSheetRowData>[] = [
			{
				key: 'name-corner',
				header: 'Planning sheet',
				headerClass: 'text-left',
				columns: [
					{
						key: 'total-tonnage-row',
						header: 'Total Tonnage (MT)',
						headerClass: 'text-left',
						columns: [
							{
								key: 'label',
								header: 'Projects / DS / TT / BOM',
								tree: true,
								sticky: true,
								class: 'w-[18rem] min-w-[18rem] max-w-[18rem] overflow-hidden',
								trailing: (node) => planningNodeDelayLabel(draft, node),
								trailingClass: 'font-medium text-red-600'
							}
						]
					}
				]
			},
			{
				key: 'totals',
				header: 'Total',
				headerClass: 'text-center',
				columns: [
					{
						key: 'totals-tonnage',
						header: totalTonnageValue,
						headerClass: 'text-center',
						columns: [
							{
								key: 'qty',
								header: 'Quantity (Set)',
								headerClass: 'text-center',
								class: 'text-center tabular-nums',
								value: (node) => formatSets(node.data?.qtySets ?? 0)
							},
							{
								key: 'weight',
								header: 'Weight (MT)',
								headerClass: 'text-center',
								class: 'text-center tabular-nums',
								value: (node) =>
									node.data?.qtyMt != null && Number.isFinite(node.data.qtyMt)
										? node.data.qtyMt.toFixed(3)
										: '-'
							},
							{
								key: 'balance',
								header: 'Balance',
								headerClass: 'text-center',
								class: 'text-center font-medium tabular-nums',
								valueClass: (node) =>
									balanceSets(draft, node) === 0 ? 'text-foreground' : 'text-red-600',
								value: (node) => formatSets(balanceSets(draft, node))
							}
						]
					}
				]
			}
		];

		for (const month of visibleMonths) {
			let monthPlannedMt = 0;
			const walk = (nodes: TreeTableNode<PlanningSheetRowData>[]) => {
				for (const node of nodes) {
					if (node.data?.kind === 'bom') {
						const sets = plannedSetsForMonth(draft, node, month);
						const qty = node.data.qtySets ?? 0;
						const mt = node.data.qtyMt;
						if (sets > 0 && qty > 0 && mt != null && Number.isFinite(mt)) {
							monthPlannedMt += (mt * sets) / qty;
						}
					} else if (node.children?.length) {
						walk(node.children);
					}
				}
			};
			walk(treeNodes);
			const monthTonnageHeader = monthPlannedMt > 0 ? `${monthPlannedMt.toFixed(3)} MT` : '—';
			const frozen = !monthEditable(month);
			const canEditMonth = isEditing && !frozen;

			const monthQtyColumn: TreeTableColumnDef<PlanningSheetRowData> = canEditMonth
				? {
						type: 'control',
						key: `plan-${month}`,
						header: 'Quantity (Set)',
						headerClass: 'text-center',
						align: 'center',
						mode: (node) => (node.data?.kind === 'bom' ? 'input' : 'checkbox'),
						checked: (node) => isMonthIncluded(draft, node.id, month),
						indeterminate: (node) => isMonthIndeterminate(draft, treeNodes, node.id, month),
						onCheckedChange: (node, checked) => {
							draft = setMonthIncluded(draft, treeNodes, node.id, month, checked);
							if (!shopFloorLocal) setWorkingDraft(draft);
						},
						value: (node) => {
							const qty = draft.monthQtyByBomId[node.id]?.[month] ?? 0;
							return String(qty);
						},
						onValueChange: (node, value) => {
							const qtySets = node.data?.kind === 'bom' ? node.data.qtySets : 0;
							const available = maxBomMonthQty(draft, node.id, month, qtySets);
							const parsed = value.trim() === '' ? 0 : Number(value);
							if (Number.isFinite(parsed) && parsed > available) {
								highlightFilledQtyInputs(node.id, month);
								return;
							}
							if (highlightedQtyKeys.length > 0) {
								highlightedQtyKeys = [];
								if (highlightClearTimer) {
									clearTimeout(highlightClearTimer);
									highlightClearTimer = null;
								}
							}
							draft = setBomMonthQty(draft, node.id, month, value, available);
							if (!shopFloorLocal) setWorkingDraft(draft);
						},
						disabled: (node) =>
							node.data?.kind === 'bom' && !isMonthIncluded(draft, node.id, month),
						inputType: 'number',
						min: 0,
						step: 1,
						placeholder: '0',
						inputClass: (node) =>
							highlightedQtyKeys.includes(qtyHighlightKey(node.id, month))
								? 'w-20 text-center border-red-500 ring-1 ring-red-500'
								: 'w-20 text-center'
					}
				: {
						key: `plan-${month}`,
						header: frozen ? 'Quantity (Set) · Frozen' : 'Quantity (Set)',
						headerClass: 'text-center',
						class: 'text-center tabular-nums',
						value: (node) => {
							if (node.data?.kind === 'bom') {
								return String(draft.monthQtyByBomId[node.id]?.[month] ?? 0);
							}
							if (isMonthIndeterminate(draft, treeNodes, node.id, month)) return '−';
							return isMonthIncluded(draft, node.id, month) ? '✓' : '—';
						}
					};

			const carryColumn: TreeTableColumnDef<PlanningSheetRowData> = {
				key: `carry-${month}`,
				header: 'Carry Forward',
				headerClass: 'text-center',
				class: 'text-center tabular-nums',
				value: (node) => {
					const n = sumCarryForward(treeNodes, node.id, month);
					return n > 0 ? formatSets(n) : '—';
				}
			};

			base.push({
				key: `month-${month}`,
				header: formatMonthLabel(month),
				headerClass: 'text-center',
				columns: [
					{
						key: `month-tonnage-${month}`,
						header: monthTonnageHeader,
						headerClass: 'text-center',
						columns: [monthQtyColumn, carryColumn]
					}
				]
			});
		}

		return base;
	});

	const toolbarButtons = $derived.by((): TreeTableToolbarButtonConfig[] => {
		void storeEpoch;
		const buttons: TreeTableToolbarButtonConfig[] = [];
		if (isLoading || treeNodes.length === 0) return buttons;

		for (const button of extraToolbarButtons) {
			if (button.enabled ?? true) buttons.push(button);
		}

		// CP only — RMI read-only sheets must not send to shop floor.
		if (!isReadOnly && !shopFloorLocal && planId !== 'new' && !isEditing) {
			buttons.push({
				enabled: true,
				label: 'Send to Shop Floor',
				icon: Send,
				variant: 'outline',
				disabled: sendMonthItems.length === 0,
				onClick: () => {
					sendMonth = sendMonthItems[0]?.value ?? '';
					isSendOpen = true;
				}
			});
		}

		if (shopFloorLocal && monthParam && !isEditing) {
			buttons.push({
				enabled: true,
				label: 'Send to APS',
				icon: Play,
				variant: 'primary',
				disabled: !shopfloorPlanId,
				onClick: () => {
					if (!shopfloorPlanId) return;
					void (async () => {
						try {
							const request = await openOrCreateRequestForShopfloor(shopfloorPlanId);
							// Sources already set for this month — Review shows Project→DS→BOM tree.
							window.location.hash = reviewInputHash(request.request_id);
						} catch (error) {
							rmiPushToast({
								title: 'Could not open APS request',
								description: formatApiErrorMessage(error)
							});
						}
					})();
				}
			});
			if (sfpFrozen) {
				buttons.push({
					enabled: true,
					label: 'Unfreeze',
					icon: Unlock,
					variant: 'outline',
					onClick: () => {
						isUnfreezeOpen = true;
					}
				});
			} else {
				buttons.push({
					enabled: true,
					label: 'Freeze',
					icon: Snowflake,
					variant: 'outline',
					onClick: () => {
						isFreezeOpen = true;
					}
				});
			}
		}

		if (isReadOnly) return buttons;

		if (!isEditing) {
			buttons.push({
				enabled: true,
				label: 'Edit',
				icon: Pencil,
				variant: 'primary',
				onClick: () => startEdit()
			});
			return buttons;
		}

		buttons.push(
			{
				enabled: true,
				label: 'Cancel',
				icon: X,
				variant: 'outline',
				disabled: isSaving,
				onClick: () => cancelEdit()
			},
			{
				enabled: true,
				label: isSaving ? 'Saving…' : 'Save',
				icon: Save,
				variant: 'primary',
				disabled: isSaving,
				loading: isSaving,
				onClick: () => void handleSave()
			}
		);
		return buttons;
	});

	async function confirmSendToShopFloor() {
		if (!sendMonth || planId === 'new') return;
		const result = await sendPlanMonthToShopFloor(planId, sendMonth);
		isSendOpen = false;
		if (!result.ok) {
			rmiPushToast({
				title: 'Could not send',
				description:
					result.reason === 'pln.month_frozen' || result.reason === 'frozen'
						? 'That month is frozen and cannot be sent again.'
						: (result.message ?? 'Send failed.')
			});
			return;
		}
		await loadShopFloorOverlay(result.shopfloorPlanId, planId, sendMonth, false);
		storeEpoch += 1;
		rmiPushToast({
			title: 'Sent to Shop Floor',
			description: `${result.plan.label} · ${formatMonthLabel(sendMonth)}`
		});
	}

	async function confirmFreeze() {
		if (!shopFloorLocal || !monthParam || !shopfloorPlanId || !planRecord) return;
		await saveShopFloorPlanDraft(shopfloorPlanId, monthParam, draft);
		const result = await freezeShopFloorMonth(shopfloorPlanId, planRecord.plantId);
		isFreezeOpen = false;
		if (!result.ok) {
			rmiPushToast({
				title: 'Could not freeze',
				description:
					result.reason === 'pln.already_frozen' || result.reason === 'already_frozen'
						? 'Month already frozen.'
						: (result.message ?? 'Freeze failed.')
			});
			return;
		}
		markShopFloorMonthFrozen(shopfloorPlanId);
		storeEpoch += 1;
		rmiPushToast({
			title: 'Month frozen',
			description: `${formatMonthLabel(monthParam)} locked. Surplus carried to ${formatMonthLabel(result.nextMonth)}.`
		});
		window.location.hash = `#/${hostAppName()}/Home`;
	}

	async function confirmUnfreeze() {
		if (!shopFloorLocal || !monthParam || !shopfloorPlanId || !planRecord) return;
		const result = await unfreezeShopFloorMonth(shopfloorPlanId, planRecord.plantId);
		isUnfreezeOpen = false;
		if (!result.ok) {
			rmiPushToast({
				title: 'Could not unfreeze',
				description: result.message
			});
			return;
		}
		markShopFloorMonthUnfrozen(shopfloorPlanId);
		const overlay = await loadShopFloorOverlay(shopfloorPlanId, planId, monthParam, false);
		draft = overlay.draft;
		storeEpoch += 1;
		rmiPushToast({
			title: 'Month unfrozen',
			description: `${formatMonthLabel(monthParam)} is editable again.`
		});
	}

	async function handleSave() {
		if (isSaving || isReadOnly) return;
		isSaving = true;
		try {
			if (shopFloorLocal) {
				if (!shopfloorPlanId || !monthParam) {
					rmiPushToast({
						title: 'Could not save',
						description:
							'Shop-floor plan is not loaded. Open the month from the plans list and try again.'
					});
					return;
				}
				await saveShopFloorPlanDraft(shopfloorPlanId, monthParam, draft);
				rmiPushToast({
					title: 'Shop Floor plan saved',
					description: `${planRecord?.label ?? planId} · ${formatMonthLabel(monthParam)}`
				});
				isEditing = false;
				editBaseline = null;
				window.location.hash = `#/${hostAppName()}/Home`;
				return;
			}

			const saved =
				planId !== 'new'
					? await updatePlanningSheetPlanDraft(planId, draft)
					: await savePlanningSheetPlan(draft);

			if (!saved) {
				rmiPushToast({
					title: 'Could not save plan',
					description: 'Plan not found.'
				});
				return;
			}

			rmiPushToast({
				title: 'Plan saved',
				description: saved.label
			});
			isEditing = false;
			editBaseline = null;
			window.location.hash = `#/${hostAppName()}/Home`;
		} catch (error) {
			rmiPushToast({
				title: 'Could not save plan',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			isEditing = false;
			editBaseline = null;
			try {
				if (planId === 'new' && !getPendingPlanName()) {
					window.location.hash = `#/${hostAppName()}/Home`;
					return;
				}

				if (shopFloorLocal && !monthParam) {
					rmiPushToast({
						title: 'Missing month',
						description: 'Open a plan month from the Shop Floor plans list.'
					});
					window.location.hash = `#/${hostAppName()}/Home`;
					return;
				}

				const treePromise = loadFuturePlanningSheetTree(controller.signal);
				if (shopFloorLocal && monthParam && planId !== 'new') {
					const [loaded, sfCtx] = await Promise.all([
						treePromise,
						loadShopFloorMonthContext(planId, monthParam, controller.signal)
					]);
					if (controller.signal.aborted) return;

					treeNodes = loaded.nodes;
					expandedIds = collectExpandableIds(loaded.nodes);
					allNodeIds = collectAllNodeIds(loaded.nodes);

					if (!sfCtx) {
						rmiPushToast({
							title: 'Shop-floor plan not found',
							description: 'This month has not been sent to the shop floor yet.'
						});
						window.location.hash = `#/${hostAppName()}/Home`;
						return;
					}

					clearPendingPlanName();
					registerShopFloorMonthPlan(
						sfCtx.central,
						sfCtx.shopfloor.shopfloor_plan_id,
						monthParam,
						sfCtx.overlay.frozen
					);
					shopfloorPlanId = sfCtx.shopfloor.shopfloor_plan_id;
					draft = sfCtx.overlay.draft;
					isEditing = false;
					storeEpoch += 1;
					return;
				}

				const planPromise =
					planId !== 'new'
						? loadPlanningSheetPlan(planId, { signal: controller.signal })
						: Promise.resolve(null);

				const [loaded, existing] = await Promise.all([treePromise, planPromise]);
				if (controller.signal.aborted) return;

				treeNodes = loaded.nodes;
				expandedIds = collectExpandableIds(loaded.nodes);
				allNodeIds = collectAllNodeIds(loaded.nodes);

				if (planId !== 'new') {
					clearPendingPlanName();
					if (existing) {
						const baseDraft = existing.draft;
						draft = {
							...baseDraft,
							months: loaded.months.length ? loaded.months : baseDraft.months
						};
						setWorkingDraft(draft);
						isEditing = false;
						return;
					}
				}

				const working = getWorkingDraft();
				if (working && planId === 'new') {
					draft = {
						...working,
						months: loaded.months
					};
				} else {
					draft = createDefaultDraft(loaded.months, loaded.nodes, allNodeIds);
					clearWorkingDraft();
				}
				setWorkingDraft(draft);
				if (planId === 'new' && !readOnly) {
					editBaseline = cloneDraftLocal(draft);
					isEditing = true;
				}
			} catch (error) {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load planning sheet',
					description: formatApiErrorMessage(error),
					variant: 'error'
				});
				treeNodes = [];
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => {
			controller.abort();
			if (highlightClearTimer) clearTimeout(highlightClearTimer);
		};
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	{#if shopFloorLocal && monthParam}
		<div class="mb-3 flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
			{#if sfpFrozen}
				<Lock class="size-4" />
				<span>Frozen · {formatMonthLabel(monthParam)}</span>
			{:else}
				<span>{formatMonthLabel(monthParam)}</span>
			{/if}
		</div>
	{/if}
	<div class="min-h-0 flex-1">
		<TreeTable
			{columns}
			nodes={treeNodes}
			bind:expandedIds
			bind:selectedIds
			loading={isLoading}
			stickyHeader
			selection={{ enabled: selectionEnabled, mode: 'multiple' }}
			search={{ enabled: true, placeholder: 'Search projects, schedules, towers, BOMs…' }}
			toolbarButton={toolbarButtons}
			emptyState={{
				title: 'No future delivery schedules',
				description:
					'Draft, confirmed, or frozen schedules dated today or later (with BOM quantities) appear here.'
			}}
		/>
	</div>
</div>

<Dialog
	bind:open={isSendOpen}
	title="Send to Shop Floor"
	hideFooter={true}
	onOpenChange={(open) => {
		if (!open) isSendOpen = false;
	}}
>
	<div class="space-y-2">
		<Label text="Month" required />
		<Combobox
			items={sendMonthItems}
			value={sendMonth}
			onValueChange={(value) => {
				sendMonth = typeof value === 'string' ? value : (value[0] ?? '');
			}}
			placeholder={sendMonthItems.length === 0 ? 'No months available' : 'Select month'}
			disabled={sendMonthItems.length === 0}
		/>
		<p class="text-sm text-muted-foreground">
			Shop Floor will see this plan for the selected month. Already-sent months can be opened again
			until they are frozen.
		</p>
	</div>
	<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-border pt-6">
		<Button variant="outline" label="Cancel" onclick={() => (isSendOpen = false)} />
		<Button
			variant="primary"
			label="Send"
			disabled={!sendMonth}
			onclick={() => void confirmSendToShopFloor()}
		/>
	</div>
</Dialog>

<ConfirmationDialog
	bind:open={isFreezeOpen}
	title="Freeze month"
	description={monthParam
		? `Freeze ${formatMonthLabel(monthParam)}? Assigned quantities become permanent. Surplus vs Central Planning carries to the next month, and this month becomes uneditable on all CP plans.`
		: 'Freeze this month?'}
	confirmLabel="Freeze"
	onConfirm={() => void confirmFreeze()}
/>

<ConfirmationDialog
	bind:open={isUnfreezeOpen}
	title="Unfreeze month"
	description={monthParam
		? `Unfreeze ${formatMonthLabel(monthParam)}? The shop-floor plan becomes editable again, and this month can be changed on Central Planning plans.`
		: 'Unfreeze this month?'}
	confirmLabel="Unfreeze"
	onConfirm={() => void confirmUnfreeze()}
/>
