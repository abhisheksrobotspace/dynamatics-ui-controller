import type { Component } from 'svelte';
import type { AppNavigation } from '../lib/navigation';

export type PmsLineId = 'angle' | 'plate' | 'manual';

export type PmsPageName =
	| 'StartJob'
	| 'StoppageReasons'
	| 'StoppedDetail'
	| 'JobComplete'
	| 'JobRunning'
	| 'JobCard'
	| 'JobCardDrawings';

export type PmsScreen = Component<{ navigation: AppNavigation }>;

export type PmsLine = {
	id: PmsLineId;
	screens: Record<PmsPageName, PmsScreen>;
};
