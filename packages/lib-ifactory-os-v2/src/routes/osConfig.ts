import { app as projectManagementApp } from '../project-management-app/app.svelte.ts';
import { app as ocrApp } from '../ocr-app/app.svelte.ts';
import { app as cuttingPlanApp } from '../cutting-plan-app/app.svelte.ts';
import { app as rmiApp } from '../rm-indent-app/app.svelte.ts';
import { app as centralPlanningApp } from '../central-planning-app/app.svelte.ts';
import { app as shopFloorPlanningApp } from '../shop-floor-planning-app/app.svelte.ts';
// import { app as assetManagerApp } from '../asset-manager-app/app.svelte.ts';
// import { app as maintenanceApp } from '../maintenance-app/app.svelte.ts';
// import { app as productionMonitoringApp } from '../production-monitoring-app/app.svelte.ts';

export const apps = {
	projectManagementApp,
	ocrApp,
	cuttingPlanApp,
	rmiApp,
	centralPlanningApp,
	shopFloorPlanningApp
	// assetManagerApp,
	// maintenanceApp,
	// productionMonitoringApp
};
