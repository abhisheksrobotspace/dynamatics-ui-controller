<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Alert, TreeTable, type TreeTableColumn, type TreeTableNode } from '@ifactory/ui-v2';
	import { Settings2 } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import {
		COEFFICIENT_HEADERS,
		COEFFICIENT_KEYS,
		LIMIT_HEADERS,
		LIMIT_KEYS,
		listMachineConfigs,
		updateMachineConfig,
		type CoefficientKey,
		type LimitKey,
		type MachineConfigRow
	} from '../lib/machine-config.api.js';
	import { pushSuccessToast } from '../lib/toast.js';

	type ConfigEditRow = {
		sNo: number;
		config_id: string;
		machine_id: string;
		step_code: string;
	} & Record<CoefficientKey | LimitKey, string>;

	let nodes = $state<TreeTableNode<ConfigEditRow>[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let errorMessage = $state<string | null>(null);
	let dirtyIds = new SvelteSet<string>();

	const hasDirty = $derived(dirtyIds.size > 0);

	function cellValue(raw: string | number | null | undefined) {
		return raw === undefined || raw === null || raw === '' ? '' : String(raw);
	}

	function coeffValue(
		coefficients: Record<string, number> | null | undefined,
		key: CoefficientKey
	) {
		return cellValue(coefficients?.[key]);
	}

	function toNode(row: MachineConfigRow, index: number): TreeTableNode<ConfigEditRow> {
		const data = {
			sNo: index + 1,
			config_id: row.config_id,
			machine_id: row.machine_id,
			step_code: row.step_code
		} as ConfigEditRow;
		for (const key of LIMIT_KEYS) {
			data[key] = cellValue(row[key]);
		}
		for (const key of COEFFICIENT_KEYS) {
			data[key] = coeffValue(row.coefficients, key);
		}
		return {
			id: row.config_id,
			label: `${row.machine_id} / ${row.step_code}`,
			data
		};
	}

	function updateField(
		node: TreeTableNode<ConfigEditRow>,
		key: CoefficientKey | LimitKey,
		value: string
	) {
		if (!node.data) return;
		node.data = { ...node.data, [key]: value };
		nodes = nodes.map((entry) => (entry.id === node.id ? { ...entry, data: node.data } : entry));
		dirtyIds.add(node.id);
	}

	function parseOptionalNumber(raw: string, label: string, machineId: string): number | null {
		const trimmed = raw.trim();
		if (!trimmed) return null;
		const num = Number(trimmed);
		if (!Number.isFinite(num)) {
			throw new Error(`Invalid number for ${label} on ${machineId}`);
		}
		return num;
	}

	function buildCoefficients(data: ConfigEditRow): Record<string, number> {
		const coefficients: Record<string, number> = {};
		for (const key of COEFFICIENT_KEYS) {
			const num = parseOptionalNumber(data[key], COEFFICIENT_HEADERS[key], data.machine_id);
			if (num !== null) coefficients[key] = num;
		}
		return coefficients;
	}

	function buildLimits(data: ConfigEditRow) {
		return {
			min_section_mm: parseOptionalNumber(
				data.min_section_mm,
				LIMIT_HEADERS.min_section_mm,
				data.machine_id
			),
			max_section_mm: parseOptionalNumber(
				data.max_section_mm,
				LIMIT_HEADERS.max_section_mm,
				data.machine_id
			),
			min_thickness_mm: parseOptionalNumber(
				data.min_thickness_mm,
				LIMIT_HEADERS.min_thickness_mm,
				data.machine_id
			),
			max_thickness_mm: parseOptionalNumber(
				data.max_thickness_mm,
				LIMIT_HEADERS.max_thickness_mm,
				data.machine_id
			)
		};
	}

	async function saveChanges() {
		if (!hasDirty || saving) return;
		saving = true;
		errorMessage = null;
		try {
			const pending = nodes.filter((node) => dirtyIds.has(node.id) && node.data);
			for (const node of pending) {
				const data = node.data!;
				await updateMachineConfig(data.config_id, {
					coefficients: buildCoefficients(data),
					...buildLimits(data)
				});
			}
			dirtyIds.clear();
			pushSuccessToast({
				title: `Saved ${pending.length} machine config${pending.length === 1 ? '' : 's'}`
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
		} finally {
			saving = false;
		}
	}

	function inputColumn(
		key: CoefficientKey | LimitKey,
		header: string
	): TreeTableColumn<ConfigEditRow> {
		return {
			key,
			header,
			type: 'input',
			inputType: 'number',
			step: 'any',
			align: 'center',
			headerClass: 'text-center',
			class: 'text-center',
			inputClass: 'w-20 text-center',
			value: (node) => node.data?.[key] ?? '',
			onValueChange: (node, value) => updateField(node, key, value)
		};
	}

	const columns: TreeTableColumn<ConfigEditRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			value: (node) => String(node.data?.sNo ?? '')
		},
		{
			key: 'machine_id',
			header: 'Machine ID',
			value: (node) => node.data?.machine_id ?? '',
			class: 'min-w-[6rem] font-semibold'
		},
		{
			key: 'step_code',
			header: 'Step',
			value: (node) => node.data?.step_code ?? '',
			class: 'min-w-[4rem]'
		},
		...LIMIT_KEYS.map((key) => inputColumn(key, LIMIT_HEADERS[key])),
		...COEFFICIENT_KEYS.map((key) => inputColumn(key, COEFFICIENT_HEADERS[key]))
	];

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			loading = true;
			errorMessage = null;
			try {
				const rows = await listMachineConfigs(controller.signal);
				nodes = rows.map((row, index) => toNode(row, index));
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				nodes = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if errorMessage}
		<div class="mb-4">
			<Alert variant="error" title="Machine config error" description={errorMessage} />
		</div>
	{/if}

	<TreeTable
		{columns}
		{nodes}
		{loading}
		search={{ enabled: true, placeholder: 'Search machine config' }}
		toolbarButton={[
			{
				enabled: loading || nodes.length > 0,
				label: saving ? 'Saving…' : 'Save Changes',
				disabled: !hasDirty || saving,
				class: 'min-w-32',
				onClick: () => void saveChanges()
			}
		]}
		emptyState={{
			icon: Settings2,
			title: 'No machine configuration yet',
			description: 'Per-machine step coefficients will appear here once configured'
		}}
	/>
</div>
