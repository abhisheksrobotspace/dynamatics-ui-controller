import type { HTMLAttributes } from 'svelte/elements';

/** Semantic color for rail, badge fill, and timer value. */
export type HmiMachineCardTone = 'online' | 'error' | 'offline' | 'loading';

/** Label / value cell (meta row or metric row). */
export type HmiMachineCardField = {
	label: string;
	value: string;
};

export type HmiMachineCardTimer = {
	label: string;
	value: string;
};

/** Empty-body CTA (e.g. no operator). */
export type HmiMachineCardEmptyState = {
	message: string;
	actionLabel?: string;
	onAction?: () => void;
};

export type HmiMachineCardProps = {
	/** Primary identity (e.g. asset id). */
	id: string;
	/** Secondary line under the id. */
	subtitle?: string;
	tone: HmiMachineCardTone;
	/** Status chip text — consumer owns copy. */
	badge: string;
	/**
	 * Meta row (typically two cells). Ignored when `emptyState` is set.
	 * Example: Operator / Job.
	 */
	fields?: HmiMachineCardField[];
	/**
	 * Large metric row (typically two cells). Ignored when `emptyState` is set.
	 * First cell uses primary emphasis; second uses default emphasis.
	 */
	metrics?: HmiMachineCardField[];
	/** Footer timer. Ignored when `emptyState` is set. */
	timer?: HmiMachineCardTimer;
	/** Replaces metrics body with a centered message (+ optional action). */
	emptyState?: HmiMachineCardEmptyState;
	class?: string;
	headerClass?: string;
	bodyClass?: string;
	footerClass?: string;
	labelClass?: string;
	valueClass?: string;
	badgeClass?: string;
} & HTMLAttributes<HTMLDivElement>;

/** @deprecated Use `HmiMachineCardField`. */
export type HmiMachineCardMetric = HmiMachineCardField;
