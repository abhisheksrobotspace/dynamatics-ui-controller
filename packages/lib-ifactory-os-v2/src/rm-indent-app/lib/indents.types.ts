export type IndentStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'closed';

export type IndentRow = {
	id: string;
	indent_no: number;
	revision: string;
	batch: string;
	work_order: string;
	ht_mt: number;
	ms_mt: number;
	total_mt: number;
	delivery_by: string;
	status: IndentStatus;
	received_pct?: number;
};

export type IndentRecord = IndentRow & {
	project_id: string;
	project_label: string;
	customer_name: string;
	tower_label: string;
	bom_label: string;
	bom_id: string;
	structure_id: string;
	cutting_plan_id: string;
	created_at: string;
	updated_at?: string;
	qty_to_lock_by_section?: Record<string, number>;
};

export type IndentSectionCategory = 'HT' | 'MS';

export type IndentSectionLine = {
	sectionKey: string;
	sectionName: string;
	category: IndentSectionCategory;
	unitWtMt: number;
	qty: number;
	inStock: number;
	requiredQty: number;
};

export type IndentDetail = {
	indent: IndentRecord;
	sections: IndentSectionLine[];
};
