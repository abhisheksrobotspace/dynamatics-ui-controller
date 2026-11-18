export interface Machine {
	machine_id: string; // UUID
	machine_name: string;
	machine_type?: string;
	description?: string;
	production_rate?: number;
	production_rate_unit?: string;
	efficiency?: number; // 0.0 to 1.0
	max_batch_size?: number;
	min_batch_size?: number;
	is_active?: boolean;
	resource_group_id?: string;
	resource_group_ids?: string[];
}

export interface Order {
	order_id: string;
	order_number: string;
	product_id: string;
	quantity: number;
	due_date?: string; // ISO8601
	priority?: number; // Lower is higher priority
}

export interface Product {
	product_id: string; // UUID
	product_name: string;
	uom: string;
	default_process_id: string; // UUID
}

export interface ProcessEdge {
	from: string; // Resource Group UUID
	to: string; // Resource Group UUID
}

export interface Process {
	process_id: string;
	nodes: string[]; // Resource Group UUIDs
	edges: ProcessEdge[];
}

export interface ResourceGroup {
	resource_group_id: string;
	resource_group_name: string;
	machines: string[]; // Machine UUIDs
	resource_group_type?: string;
}

export interface InfeasibleOrder {
	order_id: string;
	missing_nodes?: string[];
	lateness_minutes?: number;
}

// Gantt Specific Types extending the schema types
export interface ScheduledJob extends Order {
	// Defines WHEN and WHERE an order (or part of it) is executed
	start: number; // Timestamp
	end: number; // Timestamp
	machine_id: string; // Assigned machine
	status?: 'scheduled' | 'in-progress' | 'completed';
	color?: string; // For visualization
	node_id?: string; // Resource Group ID for this step
	start_abs?: string; // Format: "2023-10-27 10:00:00"
	end_abs?: string;
	duration?: number;
	setup_time?: number; // In solver time units (seconds for Jyoti)
	resource_group_name?: string; // Name from context
	product_name?: string;
	rm_group_id?: string;
	customer_order_id?: string;
	isFixed?: boolean; // True if the task was manually locked
	is_fixed?: boolean; // Parsed from the Python backend history payload
	isDimmed?: boolean;
	/** Stable unique id for a scheduled step (required when order_id+node_id is not unique). */
	task_uid?: string;
	/** Tree node ids this bar matches for sidebar highlighting (section / RMID / marking). */
	highlightIds?: string[];
	/** Jyoti: three-view DXF files beside referenced .nc (from server). */
	nc_viewer_links?: { filename: string; label: string }[];
}

export interface ContextData {
	machines: Record<string, Machine>;
	resource_group_names: Record<string, string>;
	order_numbers: Record<string, string>;
	order_groups?: Record<string, { marks: string[] }>;
	order_products?: Record<string, string>;
	order_quantities?: Record<string, number>;
}

export interface JobStructure {
	edges: Array<{ from: string; to: string } | [string, string]>;
}

// Downtime Type
export interface Downtime {
	downtime_id?: string;
	machine_id: string;
	start: number; // Relative minutes/timestamp
	end: number;
	start_abs?: string;
	end_abs?: string;
	type: string; // "MAINTENANCE" | "BREAKDOWN" | etc.
	reason?: string;
	status?: string;
}

export interface FixedTaskWarning {
	order_id: string;
	fixed_node_id: string;
	fixed_start: number;
	total_predecessor_duration: number;
	available_gap: number;
	message: string;
}

export interface VisualizationData {
	scheduled_tasks: ScheduledJob[];
	downtimes?: Downtime[]; // Added downtimes
	context: ContextData;
	files_parsed_jobs: Record<string, [JobStructure, number, unknown?]>; // Tuple of [structure, priority, deadline?]
	warnings?: FixedTaskWarning[]; // Fixed task feasibility warnings from backend
	infeasible_orders?: InfeasibleOrder[];
	simulation_info: {
		start_time: string;
	};
}
