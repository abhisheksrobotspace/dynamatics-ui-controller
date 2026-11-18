<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		Alert,
		Button,
		collectExpandableIds,
		DataTable,
		Dialog,
		TreeTable,
		type DataTableColumn,
		type TreeTableColumn,
		type TreeTableNode
	} from '@ifactory/ui-v2';
	import { AlertCircle, FileText, Lock, RefreshCw, Unlock } from '@lucide/svelte';
	import AppBusyOverlay from '../../lib/appShell/AppBusyOverlay.svelte';
	import { rmiPushToast } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { stockCandidatesForBar, type StockPickRow } from '../lib/assign-and-lock.detail';
	import {
		loadAssignAndLockTree,
		selectedSectionLengthGroups,
		type AssignLockReplanContext,
		type AssignLockTreeData,
		type SectionLengthGroup
	} from '../lib/assign-and-lock.tree';
	import { isInAppReplanHost, startSingleSectionReplan } from '../lib/assign-and-lock.replan';
	import { lockStock, releaseLock } from '../lib/inv.jobs';
	import { formatWeightMt } from '../lib/inv-views.api';
	import { isPlanningShell, resolvePlanningAppData } from '../lib/planning-capabilities';
	import { stashRaiseIndent, readCpRaiseIndentScope } from '../lib/indent-routes';
	import {
		readStockAssignmentScope,
		type StockAssignmentScope
	} from '../lib/stock-assignment.scope';
	import { ApiError } from '../../lib/api/api-error';

	let { params, data }: { params: Record<string, string>; data?: unknown } = $props();
	const projectId = $derived(params.projectId as string | undefined);
	const planId = $derived(params.planId as string | undefined);
	const planning = $derived(resolvePlanningAppData(data));
	const caps = $derived(planning.capabilities);
	/** Central / Shop Floor: compact column set (no available MT / excess / locked). */
	const planningShell = $derived(isPlanningShell(data));
	const stockScope = $derived(readStockAssignmentScope());
	const isStockAssignment = $derived(Boolean(stockScope?.projects?.length));

	let isLoading = $state(true);
	let treeNodes = $state<TreeTableNode<AssignLockTreeData>[]>([]);
	let groups = $state<SectionLengthGroup[]>([]);
	let plantId = $state('');
	let selectedIds = $state<string[]>([]);
	let expandedIds = $state<string[]>([]);

	let isSelectStockOpen = $state(false);
	let activeGroup = $state<SectionLengthGroup | null>(null);
	let stockPickRows = $state<StockPickRow[]>([]);
	let pendingPicks = $state<Array<{ stock_line_id: string; qty: number }>>([]);
	let lockGroup = $state(crypto.randomUUID());
	let isConfirming = $state(false);
	let isLockConfirmOpen = $state(false);
	let isUnlockConfirmOpen = $state(false);
	let activeLockProjectId = $state('');
	let lockMonth = $state('');
	let lockCentralPlanId = $state('');

	const overlappingPlans = $derived(groups.some((g) => g.planCount > 1));
	const anyCommitted = $derived(groups.some((g) => g.committed));

	const hasAnyLocks = $derived(groups.some((g) => g.lockedQty > 0));

	const selectDialogTitle = $derived.by(() => {
		if (!activeGroup) return 'Select stock';
		const need = Math.max(0, activeGroup.requiredQty - activeGroup.lockedQty);
		return `Select stock – ${activeGroup.section} · ${activeGroup.lengthLabel} mm × ${need} pcs`;
	});

	const remainingToLock = $derived.by(() => {
		if (!activeGroup) return 0;
		return Math.max(0, activeGroup.requiredQty - activeGroup.lockedQty);
	});

	const selectedPcs = $derived.by(() =>
		stockPickRows.reduce((sum, row) => sum + Math.max(0, Math.min(row.take_qty, row.free_pcs)), 0)
	);

	async function loadData(pid: string, centralPlanId: string, signal?: AbortSignal) {
		isLoading = true;
		try {
			const cpScope = readCpRaiseIndentScope(pid);
			const month = cpScope?.month ?? lockMonth;
			if (!month) {
				rmiPushToast({
					title: 'Missing month',
					description: 'Open Assign & Lock from a plan month or Stock Assignment.'
				});
				treeNodes = [];
				groups = [];
				return;
			}
			lockMonth = month;
			lockCentralPlanId = cpScope?.sheetPlanId ?? centralPlanId;
			const loaded = await loadAssignAndLockTree({
				projectId: pid,
				month,
				centralPlanId: lockCentralPlanId || undefined,
				...(cpScope
					? {
							deliveryScheduleIds: cpScope.deliveryScheduleIds,
							...(cpScope.bomIds?.length ? { bomIds: cpScope.bomIds } : {})
						}
					: {}),
				signal
			});

			treeNodes = loaded.nodes;
			groups = loaded.groups;
			plantId = loaded.plantId;
			expandedIds = collectExpandableIds(loaded.nodes);

			const selectableIds = new Set(
				loaded.nodes.flatMap(collectSelectableLeafIdsFromNode).filter(Boolean)
			);
			selectedIds = selectedIds.filter((id) => selectableIds.has(id));
		} finally {
			if (!signal?.aborted) isLoading = false;
		}
	}

	function annotateProjectContext(
		nodes: TreeTableNode<AssignLockTreeData>[],
		nextProjectId: string
	): TreeTableNode<AssignLockTreeData>[] {
		return nodes.map((node) => ({
			...node,
			id: `${nextProjectId}::${node.id}`,
			data: node.data
				? { ...node.data, projectId: nextProjectId }
				: {
						kind: 'schedule' as const,
						requiredQty: 0,
						requiredWeightKg: null,
						projectId: nextProjectId
					},
			children: node.children?.length
				? annotateProjectContext(node.children, nextProjectId)
				: undefined
		}));
	}

	async function loadStockAssignmentData(scope: StockAssignmentScope, signal?: AbortSignal) {
		isLoading = true;
		try {
			const roots: TreeTableNode<AssignLockTreeData>[] = [];
			const allGroups: SectionLengthGroup[] = [];

			lockMonth = scope.months[0] ?? '';
			lockCentralPlanId = '';
			for (const project of scope.projects) {
				const loaded = await loadAssignAndLockTree({
					projectId: project.projectId,
					month: lockMonth,
					deliveryScheduleIds: project.deliveryScheduleIds,
					bomIds: project.bomIds,
					signal
				});
				if (signal?.aborted) return;
				const annotated = annotateProjectContext(loaded.nodes, project.projectId);
				allGroups.push(...loaded.groups);
				const totals = annotated.reduce(
					(acc, node) => ({
						requiredQty: acc.requiredQty + (node.data?.requiredQty ?? 0),
						requiredWeightKg:
							acc.requiredWeightKg == null || node.data?.requiredWeightKg == null
								? null
								: acc.requiredWeightKg + node.data.requiredWeightKg
					}),
					{ requiredQty: 0, requiredWeightKg: 0 as number | null }
				);
				roots.push({
					id: `project:${project.projectId}`,
					label: project.projectLabel || project.projectId,
					defaultExpanded: true,
					selectable: false,
					data: {
						kind: 'schedule',
						requiredQty: totals.requiredQty,
						requiredWeightKg: totals.requiredWeightKg,
						projectId: project.projectId
					},
					children: annotated
				});
			}

			treeNodes = roots;
			groups = allGroups;
			plantId = scope.plantId;
			expandedIds = collectExpandableIds(roots);
			selectedIds = [];

			if (allGroups.length === 0) {
				rmiPushToast({
					title: 'Nothing to lock',
					description:
						'No section requirements for this selection. Assign qty greater than 0 in the central plan for this month (and publish a cutting plan if needed), then try again.',
					duration: 10_000
				});
			}
		} finally {
			if (!signal?.aborted) isLoading = false;
		}
	}

	function collectSelectableLeafIdsFromNode(node: TreeTableNode<AssignLockTreeData>): string[] {
		if (node.data?.kind === 'section-length' && node.selectable !== false) {
			return [node.id];
		}
		return (node.children ?? []).flatMap(collectSelectableLeafIdsFromNode);
	}

	function isLeafNode(node: TreeTableNode<AssignLockTreeData>): boolean {
		return node.data?.kind === 'section-length';
	}

	async function reloadAfterMutation() {
		const scope = readStockAssignmentScope();
		if (scope?.projects?.length) {
			await loadStockAssignmentData(scope);
			return;
		}
		if (projectId && planId) await loadData(projectId, planId);
	}

	async function openLockDialog(group: SectionLengthGroup, ctx?: { projectId?: string }) {
		activeLockProjectId = ctx?.projectId || projectId || '';
		if (group.unresolved || !group.itemId) {
			rmiPushToast({
				title: 'No matching item',
				description: `No inventory item for section ${group.section}. Upload stock for this section first.`
			});
			return;
		}
		if (group.requiredQty - group.lockedQty <= 0) {
			rmiPushToast({
				title: 'Already locked',
				description: 'Required quantity is already fully locked for this section.'
			});
			return;
		}
		activeGroup = group;
		try {
			stockPickRows = await stockCandidatesForBar({
				projectId: activeLockProjectId || projectId || '',
				itemId: group.itemId,
				lengthMm: group.lengthMm,
				requiredQty: Math.max(0, group.requiredQty - group.lockedQty),
				section: group.section
			});
			if (stockPickRows.length === 0) {
				rmiPushToast({
					title: 'No lockable stock',
					description: `No free stock lines with BOM section “${group.section}” at this length. Re-upload the stock report after fixing aliases, or pick another length.`
				});
				return;
			}
			isSelectStockOpen = true;
		} catch (error) {
			rmiPushToast({ title: 'Failed to load stock', description: formatApiErrorMessage(error) });
		}
	}

	function setTakeQty(rowId: string, value: string) {
		const parsed = value.trim() === '' ? 0 : Math.floor(Number(value));
		if (!Number.isFinite(parsed)) return;
		const othersTaken = stockPickRows
			.filter((row) => row.id !== rowId)
			.reduce((sum, row) => sum + Math.max(0, Math.min(row.take_qty, row.free_pcs)), 0);
		const roomForNeed = Math.max(0, remainingToLock - othersTaken);
		stockPickRows = stockPickRows.map((row) => {
			if (row.id !== rowId) return row;
			const take_qty = Math.max(0, Math.min(parsed, row.free_pcs, roomForNeed));
			return { ...row, take_qty };
		});
	}

	function confirmStockSelection() {
		if (!activeGroup || selectedPcs <= 0) return;

		let remaining = remainingToLock;
		const picks: Array<{ stock_line_id: string; qty: number }> = [];
		for (const row of stockPickRows) {
			if (remaining <= 0) break;
			const want = Math.max(0, Math.min(row.take_qty, row.free_pcs));
			if (want <= 0) continue;
			const qty = Math.min(want, remaining);
			picks.push({ stock_line_id: row.id, qty });
			remaining -= qty;
		}

		if (picks.length === 0) {
			rmiPushToast({
				title: 'Nothing to lock',
				description: 'Enter how many pcs to lock from each bundle.'
			});
			return;
		}

		pendingPicks = picks;
		isSelectStockOpen = false;
		isLockConfirmOpen = true;
	}

	async function confirmLockGesture() {
		const lockProject = activeLockProjectId || projectId || '';
		if (
			!lockProject ||
			!lockMonth ||
			!activeGroup?.deliveryScheduleLineId ||
			pendingPicks.length === 0
		) {
			rmiPushToast({
				title: 'Cannot lock',
				description: 'Missing month or delivery-schedule line for this row.'
			});
			return;
		}
		isConfirming = true;
		try {
			const result = await lockStock({
				lock_group: lockGroup,
				project_id: lockProject,
				month: lockMonth,
				delivery_schedule_line_id: activeGroup.deliveryScheduleLineId,
				picks: pendingPicks,
				...(lockCentralPlanId ? { central_plan_id: lockCentralPlanId } : {})
			});
			isLockConfirmOpen = false;
			pendingPicks = [];
			activeGroup = null;
			lockGroup = crypto.randomUUID();
			rmiPushToast({
				title: 'Material locked',
				description: `${result.locked_qty} pcs locked`
			});
			await reloadAfterMutation();
		} catch (error) {
			if (error instanceof ApiError && error.code === 'inv.lock_conflict') {
				rmiPushToast({ title: 'First lock wins', description: error.message });
				isLockConfirmOpen = false;
				pendingPicks = [];
				await reloadAfterMutation();
				return;
			}
			rmiPushToast({
				title: 'Confirm & Lock failed',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isConfirming = false;
		}
	}

	async function confirmUnlockAll() {
		isConfirming = true;
		try {
			const scopes: Array<{ projectId: string; month: string }> = [];
			if (isStockAssignment && stockScope) {
				const month = stockScope.months[0] ?? lockMonth;
				for (const project of stockScope.projects) {
					scopes.push({ projectId: project.projectId, month });
				}
			} else if (projectId && lockMonth) {
				scopes.push({ projectId, month: lockMonth });
			} else {
				return;
			}

			let released = 0;
			let unwound = 0;
			for (const scope of scopes) {
				const result = await releaseLock({
					scope: {
						project_id: scope.projectId,
						month: scope.month
					},
					reason: 'manual'
				});
				released += result.released;
				unwound += result.unwound_lines;
			}
			if (released === 0) {
				rmiPushToast({
					title: 'Nothing to unlock',
					description: 'No active locks for this month.'
				});
				isUnlockConfirmOpen = false;
				return;
			}
			isUnlockConfirmOpen = false;
			rmiPushToast({
				title: 'Locks released',
				description: `${released} locks released · ${unwound} stock lines updated`
			});
			await reloadAfterMutation();
		} catch (error) {
			rmiPushToast({
				title: 'Unlock failed',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isConfirming = false;
		}
	}

	function isFullyLocked(group: SectionLengthGroup): boolean {
		return group.lockedQty >= group.requiredQty && group.requiredQty > 0;
	}

	/** DS + BOM ids for selected leaves — used when CP session scope is missing. */
	function scopeFromSelectedLeaves(selected: SectionLengthGroup[]): {
		deliveryScheduleIds: string[];
		bomIds: string[];
	} {
		const selectedKeys = new Set(selected.map((group) => group.groupKey));
		const scheduleIds = new SvelteSet<string>();
		const bomIds = new SvelteSet<string>();
		const walk = (nodes: TreeTableNode<AssignLockTreeData>[]) => {
			for (const node of nodes) {
				const group = node.data?.group;
				if (node.data?.kind === 'section-length' && group && selectedKeys.has(group.groupKey)) {
					const match = /^ds:([^|]+)\|tower:[^|]*\|bom:([^|]+)\|/.exec(node.id);
					if (match?.[1]) scheduleIds.add(match[1]);
					if (match?.[2]) bomIds.add(match[2]);
				}
				if (node.children?.length) walk(node.children);
			}
		};
		walk(treeNodes);
		return {
			deliveryScheduleIds: [...scheduleIds],
			bomIds: [...bomIds]
		};
	}

	function navigateToRaiseIndent(selected: SectionLengthGroup[]) {
		if (!projectId || !planId || selected.length === 0) return;
		const indentRows = selected.filter((group) => !isFullyLocked(group));
		if (indentRows.length === 0) {
			rmiPushToast({
				title: 'Nothing to indent',
				description: 'Selected rows are already fully locked.'
			});
			return;
		}
		const cpScope = readCpRaiseIndentScope(projectId);
		const fromLeaves = scopeFromSelectedLeaves(indentRows);
		const deliveryScheduleIds = cpScope?.deliveryScheduleIds?.length
			? cpScope.deliveryScheduleIds
			: fromLeaves.deliveryScheduleIds;
		const bomIds = cpScope?.bomIds?.length ? cpScope.bomIds : fromLeaves.bomIds;

		if (!caps.canLock && deliveryScheduleIds.length === 0) {
			rmiPushToast({
				title: 'Missing delivery schedules',
				description:
					'Could not resolve delivery schedules for the selected sections. Go back and try again.'
			});
			return;
		}

		stashRaiseIndent({
			projectId,
			...(plantId ? { plantId } : {}),
			planId: cpScope?.sheetPlanId ?? planId,
			month: cpScope?.month ?? lockMonth,
			rowKeys: indentRows.map((group) => group.groupKey),
			rows: indentRows.map((group) => ({
				itemId: group.itemId,
				section: group.section,
				lengthMm: group.lengthMm,
				requiredQty: group.requiredQty,
				availableQty: group.availableQty,
				lockedQty: group.lockedQty,
				requiredWeightKg: group.requiredWeightKg,
				lockedWeightKg: group.lockedWeightKg
			})),
			...(deliveryScheduleIds.length ? { deliveryScheduleIds } : {}),
			...(bomIds.length ? { bomIds } : {})
		});
		if (cpScope || !caps.canLock) {
			const sheetPlanId = cpScope?.sheetPlanId ?? planId;
			window.location.hash = `#/${planning.appName}/Sheet/${encodeURIComponent(sheetPlanId)}/RaiseIndent/${encodeURIComponent(projectId)}`;
			return;
		}
		window.location.hash = `#/${planning.appName}/ManufacturingPlan/${encodeURIComponent(planId)}/GroupedAssignAndLock/${encodeURIComponent(projectId)}/RaiseIndent`;
	}

	async function handleReplan(
		group: SectionLengthGroup,
		replan: AssignLockReplanContext,
		replanProjectId?: string
	) {
		const pid = replanProjectId || projectId;
		if (!pid) return;
		try {
			await startSingleSectionReplan({
				projectId: pid,
				sectionName: group.section,
				replan,
				excludeStockLengthMm: group.lengthMm,
				deliveryScheduleLineId: group.deliveryScheduleLineId,
				hostAppName: isInAppReplanHost(planning.appName) ? planning.appName : 'CuttingPlan'
			});
		} catch (error) {
			rmiPushToast({
				title: 'Could not start replan',
				description: formatApiErrorMessage(error)
			});
		}
	}

	const indentableSelectedCount = $derived(
		selectedSectionLengthGroups(treeNodes, selectedIds).filter((group) => !isFullyLocked(group))
			.length
	);

	const rowActionClass = 'text-primary border-primary hover:bg-primary/10';

	const columns = $derived.by((): TreeTableColumn<AssignLockTreeData>[] => {
		const all: TreeTableColumn<AssignLockTreeData>[] = [
			{
				key: 'label',
				header: 'Delivery Schedule / Tower / BOM / Section',
				tree: true,
				sticky: true,
				class: '!w-[16rem] min-w-[12rem] max-w-[16rem] overflow-hidden font-medium',
				headerClass: 'truncate'
			},
			{
				key: 'lengthLabel',
				header: 'Length (mm)',
				value: (node) => {
					if (!isLeafNode(node) || !node.data?.group) return '';
					return node.data.group.lengthLabel;
				}
			},
			{
				key: 'requiredQty',
				header: 'Required (pcs)',
				value: (node) =>
					node.data?.requiredQty != null && node.data.requiredQty > 0
						? String(node.data.requiredQty)
						: ''
			},
			{
				key: 'requiredWeightKg',
				header: 'Required (MT)',
				value: (node) =>
					node.data?.requiredWeightKg != null ? formatWeightMt(node.data.requiredWeightKg) : ''
			},
			{
				key: 'availableQty',
				header: planningShell ? 'In stock (pcs)' : 'Available (stock)',
				value: (node) => {
					if (!isLeafNode(node)) return '';
					return node.data?.availableQty != null ? String(node.data.availableQty) : '';
				}
			},
			{
				key: 'freeWeightKg',
				header: 'Available (MT)',
				value: (node) => {
					if (!isLeafNode(node)) return '';
					return formatWeightMt(node.data?.freeWeightKg);
				}
			},
			{
				key: 'excessShort',
				header: 'Excess / Short',
				value: (node) => {
					if (!isLeafNode(node) || !node.data?.group) return '';
					const group = node.data.group;
					const diff = group.lockedQty - group.requiredQty;
					return diff >= 0 ? `+${diff}` : String(diff);
				}
			},
			{
				key: 'lockedQty',
				header: 'Locked (pcs)',
				value: (node) => {
					if (!isLeafNode(node)) return '';
					return node.data?.lockedQty != null ? String(node.data.lockedQty) : '';
				}
			},
			{
				key: 'lockedWeightKg',
				header: 'Locked (MT)',
				value: (node) => {
					if (!isLeafNode(node)) return '';
					return formatWeightMt(node.data?.lockedWeightKg);
				}
			},
			{
				key: 'actions',
				header: 'Actions',
				type: 'actions',
				align: 'start',
				actions: (node) => {
					const group = node.data?.group;
					const replan = node.data?.replan;
					if (!group) return [];

					const actions: Array<{
						label?: string;
						icon?: typeof Lock;
						variant?: 'outline' | 'ghost';
						size?: 'sm';
						disabled?: boolean;
						class?: string;
						onClick?: () => void;
					}> = [];

					const fullyLocked = isFullyLocked(group);
					const noStock = !isStockAssignment && group.availableQty < 1;

					if (caps.canLock) {
						actions.push({
							label: fullyLocked ? 'Locked' : 'Lock',
							icon: Lock,
							variant: 'outline',
							size: 'sm',
							disabled: group.unresolved || !group.itemId || fullyLocked || noStock,
							// Fixed width so Lock matches Locked (tailwind must see this literal).
							class: 'text-primary border-primary hover:bg-primary/10 w-28 shrink-0',
							onClick: () =>
								void openLockDialog(group, {
									projectId: node.data?.projectId
								})
						});
					}

					if (caps.canRaiseIndent && !isStockAssignment && !fullyLocked) {
						actions.push({
							label: 'Raise Indent',
							icon: FileText,
							variant: 'outline',
							size: 'sm',
							class: rowActionClass,
							onClick: () => navigateToRaiseIndent([group])
						});
					}

					if (caps.canReplan && replan) {
						actions.push({
							label: 'Replan',
							icon: RefreshCw,
							variant: 'outline',
							size: 'sm',
							disabled: isLoading,
							class: rowActionClass,
							onClick: () => void handleReplan(group, replan, node.data?.projectId)
						});
					}

					return actions;
				}
			}
		];

		if (!planningShell) return all;

		const keep = new Set(
			caps.canLock
				? ['label', 'lengthLabel', 'requiredQty', 'requiredWeightKg', 'availableQty', 'actions']
				: ['label', 'lengthLabel', 'requiredQty', 'requiredWeightKg', 'actions']
		);
		return all.filter((col) => keep.has(col.key));
	});

	const toolbarButtons = $derived.by(() => {
		const buttons: Array<{
			enabled: boolean;
			label: string;
			icon?: typeof Unlock;
			variant?: 'outline' | 'primary';
			disabled?: boolean;
			onClick?: () => void;
		}> = [];
		if (caps.canLock) {
			buttons.push({
				enabled: true,
				label: 'Unlock All',
				icon: Unlock,
				variant: 'outline',
				disabled: isLoading || !hasAnyLocks || isConfirming,
				onClick: () => {
					isUnlockConfirmOpen = true;
				}
			});
		}
		if (caps.canRaiseIndent && !isStockAssignment) {
			buttons.push({
				enabled: true,
				label: `Raise Indent${indentableSelectedCount ? ` (${indentableSelectedCount})` : ''}`,
				icon: FileText,
				disabled: isLoading || indentableSelectedCount === 0,
				onClick: () => navigateToRaiseIndent(selectedSectionLengthGroups(treeNodes, selectedIds))
			});
		}
		return buttons;
	});

	const stockPickColumns = $derived.by((): DataTableColumn<StockPickRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			class: 'w-12',
			value: (row) => {
				const index = stockPickRows.findIndex((item) => item.id === row.id);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			type: 'text',
			key: 'bundle_no',
			header: 'Bundle No',
			class: 'w-[18%] min-w-0 max-w-[8rem] truncate font-medium text-primary',
			value: (row) => row.bundle_no
		},
		{
			type: 'text',
			key: 'batch',
			header: 'Batch',
			class: 'w-[22%] min-w-0 max-w-[10rem] truncate',
			value: (row) => row.batch
		},
		{
			type: 'text',
			key: 'physical_location',
			header: 'Location',
			class: 'w-[22%] min-w-0 max-w-[9rem] truncate',
			value: (row) => row.physical_location
		},
		{
			type: 'text',
			key: 'free_pcs',
			header: 'Free',
			class: 'w-16 tabular-nums',
			value: (row) => row.free_label
		},
		{
			type: 'input',
			key: 'take_qty',
			header: 'Lock',
			inputType: 'number',
			step: 1,
			min: 0,
			max: (row) => {
				const othersTaken = stockPickRows
					.filter((other) => other.id !== row.id)
					.reduce((sum, other) => sum + Math.max(0, Math.min(other.take_qty, other.free_pcs)), 0);
				const roomForNeed = Math.max(0, remainingToLock - othersTaken);
				return Math.min(row.free_pcs, roomForNeed);
			},
			class: 'w-24',
			inputClass: 'w-20',
			value: (row) => (row.take_qty > 0 ? String(row.take_qty) : ''),
			onValueChange: (row, value) => setTakeQty(row.id, value),
			ariaLabel: (row) => `Lock pcs from bundle ${row.bundle_no}`
		}
	]);

	onMount(() => {
		const controller = new AbortController();
		const scope = readStockAssignmentScope();
		if (scope?.projects?.length) {
			void loadStockAssignmentData(scope, controller.signal).catch((error) => {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load data',
					description: formatApiErrorMessage(error)
				});
				isLoading = false;
			});
			return () => controller.abort();
		}
		if (!projectId || !planId) {
			isLoading = false;
			return;
		}
		void loadData(projectId, planId, controller.signal).catch((error) => {
			if (controller.signal.aborted) return;
			rmiPushToast({
				title: 'Failed to load data',
				description: formatApiErrorMessage(error)
			});
			isLoading = false;
		});
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	{#if !isStockAssignment && (!projectId || !planId)}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">No project selected</h3>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col p-3 md:p-4">
			{#if anyCommitted || overlappingPlans}
				<div class="mb-3 space-y-2">
					{#if anyCommitted}
						<p class="text-xs text-muted-foreground">
							<span class="rounded border border-border px-1.5 py-0.5">Committed</span>
							Quantities for this month come from the frozen shop-floor plan.
						</p>
					{/if}
					{#if overlappingPlans}
						<Alert
							variant="warning"
							accentBorder
							title="Multiple central plans overlap this month"
							description="Required quantities are summed across those plans. Confirm they are additive slices, not alternative scenarios."
						/>
					{/if}
				</div>
			{/if}
			<div class="min-h-0 flex-1">
				<TreeTable
					class="min-h-0 flex-1"
					nodes={treeNodes}
					{columns}
					bind:expandedIds
					bind:selectedIds
					loading={isLoading}
					selection={{ enabled: caps.canRaiseIndent && !isStockAssignment, mode: 'multiple' }}
					search={{ enabled: true, placeholder: 'Search schedules, towers, BOMs, sections…' }}
					toolbarButton={toolbarButtons}
					emptyState={{
						icon: AlertCircle,
						title: 'No section requirements found',
						description:
							'Make sure delivery schedules with completed cutting plans are linked to this project.'
					}}
				/>
			</div>
		</div>
	{/if}
</div>

<Dialog
	bind:open={isSelectStockOpen}
	title={selectDialogTitle}
	size="lg"
	class="sm:max-w-3xl"
	hideFooter={true}
	onOpenChange={(open) => {
		if (!open) {
			activeGroup = null;
			stockPickRows = [];
		}
	}}
>
	<div class="min-w-0 space-y-3 overflow-x-hidden">
		<p class="text-sm text-muted-foreground">
			Enter how many pcs to lock from each bundle (max = Free, and not more than required). Need
			{remainingToLock} pcs.
		</p>
		<DataTable
			class="min-w-0"
			tableClass="!w-full max-w-full table-fixed"
			maxHeight="min(55vh, 24rem)"
			columns={stockPickColumns}
			rows={stockPickRows}
			rowKey={(row) => row.id}
			selection={{ enabled: false }}
			search={{ enabled: false }}
			export={{ enabled: false }}
			toolbarButton={{ enabled: false, label: '' }}
			pagination={{ enabled: false }}
			sorting={{ enabled: false }}
			filtering={{ enabled: false }}
			emptyState={{
				title: 'No matching stock',
				description: 'Exact length match only.'
			}}
			rowClass={(row) => (row.take_qty > 0 ? 'bg-primary/5' : '')}
		/>
		<div class="flex w-full items-center justify-between gap-3 border-t border-border pt-4">
			<Button
				variant="outline"
				label="Cancel"
				onclick={() => {
					isSelectStockOpen = false;
				}}
			/>
			<Button
				variant="primary"
				label="Lock pcs"
				disabled={selectedPcs === 0 || selectedPcs > remainingToLock || isConfirming}
				onclick={() => confirmStockSelection()}
			/>
		</div>
	</div>
</Dialog>

<Dialog
	bind:open={isLockConfirmOpen}
	title="Confirm & Lock"
	size="sm"
	cancelLabel="Cancel"
	confirmLabel={isConfirming ? 'Locking…' : 'Confirm Lock'}
	onConfirm={() => void confirmLockGesture()}
	onCancel={() => {
		pendingPicks = [];
		activeGroup = null;
	}}
>
	<div class="space-y-3">
		<p class="text-sm text-muted-foreground">
			Lock {pendingPicks.reduce((sum, pick) => sum + pick.qty, 0)} pcs from the selected stock?
		</p>
		{#if activeGroup && activeGroup.availableQty < activeGroup.requiredQty}
			<Alert
				variant="warning"
				accentBorder
				title="Section is short"
				description="Raise an RM indent for any remaining shortfall after locking."
			/>
		{/if}
	</div>
</Dialog>

<Dialog
	bind:open={isUnlockConfirmOpen}
	title="Unlock all"
	size="sm"
	cancelLabel="Cancel"
	confirmLabel={isConfirming ? 'Unlocking…' : 'Unlock All'}
	onConfirm={() => void confirmUnlockAll()}
>
	<div class="space-y-3">
		<p class="text-sm text-muted-foreground">
			Release all locks for this project and month? Stock will return to free.
		</p>
	</div>
</Dialog>

<AppBusyOverlay
	open={isConfirming && !isSelectStockOpen && !isLockConfirmOpen && !isUnlockConfirmOpen}
	title="Updating locks"
	description="This may take a moment…"
/>
