import Home from './routes/Home.svelte';
import Customers from './routes/Customers.svelte';
import Contractors from './routes/Contractors.svelte';
import ContractorSampleMarkings from './routes/ContractorSampleMarkings.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';

// TEMPORARY MITIGATION: @ifactory/ui-v2 NumberInput bug
// The ui-v2 library attempts to call setSelectionRange on type="number" which throws InvalidStateError in modern browsers.
// Since we are restricted from modifying/building the shared UI library right now, we intercept and swallow this specific call at the OS level.
if (typeof HTMLInputElement !== 'undefined') {
	const originalSetSelectionRange = HTMLInputElement.prototype.setSelectionRange;
	HTMLInputElement.prototype.setSelectionRange = function (
		start: number | null,
		end: number | null,
		direction?: 'forward' | 'backward' | 'none'
	) {
		if (this.type === 'number') return;
		originalSetSelectionRange.call(this, start, end, direction);
	};
}
import ProjectDashboard from './routes/ProjectDashboard.svelte';
import CuttingPlanConfiguration from './routes/CuttingPlanConfiguration.svelte';
import OperationsCountConfiguration from './routes/OperationsCountConfiguration.svelte';
import Towers from './routes/Towers.svelte';
import Stubs from './routes/Stubs.svelte';
import Releases from './routes/Releases.svelte';
import ProductionPlans from './routes/ProductionPlans.svelte';
import ProductionPlanQrc from './routes/ProductionPlanQrc.svelte';
import ProductionPlan from './routes/ProductionPlan.svelte';
import BomItems from './routes/BomItems.svelte';
import Boms from './routes/Boms.svelte';
import BomVersions from './routes/BomVersions.svelte';
import BomVersionDetail from './routes/BomVersionDetail.svelte';
import BomDrawingSetDetail from './routes/BomDrawingSetDetail.svelte';
import StubBoms from './routes/StubBoms.svelte';
import Release from './routes/Release.svelte';
import Qrc from './routes/Qrc.svelte';
import DeliverySchedule from './routes/DeliverySchedule.svelte';
import DeliverySchedules from './routes/DeliverySchedules.svelte';
import DeliveryScheduleView from './routes/DeliveryScheduleView.svelte';
import { projectStore } from './lib/store.svelte';
import { ensureProjectBreadcrumb } from './lib/projects/load-project.js';
import { projectBreadcrumbLabel } from './lib/projects/breadcrumb-registry.js';
import { ensureReleaseBreadcrumb } from './lib/projects/load-release.js';
import { deliveryScheduleLabel } from './lib/projects/delivery-schedule-label.js';
import { ensureDeliveryScheduleBreadcrumb } from './lib/projects/load-delivery-schedule-page.js';
import { ensureTowerLoaded } from './lib/projects/load-towers.js';
import { ensureBomLoaded } from './lib/projects/load-boms.js';
import { ensureStubLoaded } from './lib/projects/load-stubs.js';
import { ensureStubBomLoaded } from './lib/projects/load-stub-boms.js';
import {
	ensureContractorBreadcrumb,
	getContractorBreadcrumb
} from './lib/projects/load-contractor.js';

export const app = {
	appName: 'ProjectManagement',
	appCode: 'PM',
	displayName: 'Project Management',
	dockColor: '#84CC16',
	icon: '/assets/icons/reports.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	routes: {
		Home: Home,
		Customers: Customers,
		Contractors: Contractors,
		'Contractors/:contractorId/SampleMarkings': ContractorSampleMarkings,
		'Home/:projectId/Towers/:towerId/Boms': Boms,
		'Home/:projectId/Towers/:towerId/Boms/lineage/:lineageId/Versions': BomVersions,
		'Home/:projectId/Towers/:towerId/Boms/:bomId/Detail': BomVersionDetail,
		'Home/:projectId/Towers/:towerId/Boms/:bomId/DrawingSets/:drawingSetName': BomDrawingSetDetail,
		'Home/:projectId/Towers/:towerId/Boms/:bomId/Items': BomItems,
		'Home/:projectId/Stubs/:stubId/Boms': StubBoms,
		'Home/:projectId/Stubs/:stubId/Boms/lineage/:lineageId/Versions': BomVersions,
		'Home/:projectId/Stubs/:stubId/Boms/:bomId/Detail': BomVersionDetail,
		'Home/:projectId/Stubs/:stubId/Boms/:bomId/DrawingSets/:drawingSetName': BomDrawingSetDetail,
		'Home/:projectId/Stubs/:stubId/Boms/:bomId/Items': BomItems,
		'Home/:projectId/Releases/:releaseId': Release,
		'Home/:projectId/Towers': Towers,
		'Home/:projectId/Stubs': Stubs,
		'Home/:projectId/CuttingPlanConfiguration': CuttingPlanConfiguration,
		'Home/:projectId/OperationsCountConfiguration': OperationsCountConfiguration,
		'Home/:projectId/Qrc': Qrc,
		'Home/:projectId/DeliverySchedule': DeliverySchedule,
		'Home/:projectId/DeliverySchedule/DeliverySchedules': DeliverySchedules,
		'Home/:projectId/DeliverySchedule/DeliverySchedules/:scheduleId': DeliveryScheduleView,
		'Home/:projectId/Releases': Releases,
		'Home/:projectId/ProductionPlanQrc': ProductionPlanQrc,
		'Home/:projectId/ProductionPlans/:planId': ProductionPlan,
		'Home/:projectId/ProductionPlans': ProductionPlans,
		'Home/:projectId': ProjectDashboard
	},
	menu: {
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			const { projectId, towerId, stubId, bomId, releaseId, scheduleId, contractorId, lineageId } =
				params;

			if (contractorId && pattern.includes('contractorId')) {
				await ensureContractorBreadcrumb(contractorId, signal);
			}

			if (!projectId) return;

			await ensureProjectBreadcrumb(projectId, signal);

			const routeLoadsOwnBomData =
				pattern.includes('/Versions') ||
				pattern.endsWith('/Detail') ||
				pattern.includes('/DrawingSets/');

			if (releaseId && pattern.includes('releaseId')) {
				await ensureReleaseBreadcrumb(releaseId, projectId, signal);
			}

			if (scheduleId && pattern.includes('scheduleId')) {
				await ensureDeliveryScheduleBreadcrumb(scheduleId, projectId, signal);
			}

			if (towerId && pattern.includes('towerId')) {
				await ensureTowerLoaded(towerId, projectId, signal);
			}

			if (towerId && lineageId && pattern.includes('lineageId') && !routeLoadsOwnBomData) {
				// Lineage id = v1 bom_id — one-row fetch is enough for the crumb label.
				await ensureBomLoaded(projectId, towerId, lineageId, signal);
			}

			if (stubId && pattern.includes('stubId')) {
				await ensureStubLoaded(stubId, projectId, signal);
			}

			if (stubId && lineageId && pattern.includes('lineageId') && !routeLoadsOwnBomData) {
				await ensureStubBomLoaded(projectId, stubId, lineageId, signal);
			}

			if (towerId && bomId && pattern.includes('bomId') && !routeLoadsOwnBomData) {
				await ensureBomLoaded(projectId, towerId, bomId, signal);
			}

			if (stubId && bomId && pattern.includes('bomId') && !routeLoadsOwnBomData) {
				await ensureStubBomLoaded(projectId, stubId, bomId, signal);
			}
		},
		routeTitles: {
			Home: 'Projects',
			Customers: 'Customers',
			Contractors: 'Contractors',
			'Contractors/:contractorId/SampleMarkings': 'Sample Markings',
			'Home/:projectId/OperationsCountConfiguration': 'Operations Count',
			'Home/:projectId/CuttingPlanConfiguration': 'Cutting Plan',
			'Home/:projectId/Towers': 'Tower Types',
			'Home/:projectId/Towers/:towerId/Boms': 'Subtypes',
			'Home/:projectId/Stubs': 'Stubs',
			'Home/:projectId/Stubs/:stubId/Boms': 'Subtypes',
			'Home/:projectId/Releases': 'Releases',
			'Home/:projectId/Qrc': 'Quantity Requirement Sheet',
			'Home/:projectId/DeliverySchedule': 'Delivery Plan',
			// 'Home/:projectId/DeliverySchedule/DeliverySchedules': 'Delivery Schedules',
			// 'Home/:projectId/DeliverySchedule/DeliverySchedules/:releaseId': 'Delivery Schedule',
			'Home/:projectId/ProductionPlanQrc': 'Production Plan',
			'Home/:projectId/ProductionPlans': 'Production Plans'
		},
		breadcrumbParents: {},
		postProcessBreadcrumbs: (
			crumbs: { label: string; href: string; clickable: boolean }[],
			pattern: string,
			params: Record<string, string>
		) => {
			const { projectId, towerId, stubId, releaseId, scheduleId, contractorId } = params;

			if (pattern === 'Contractors/:contractorId/SampleMarkings' && contractorId) {
				const contractor = getContractorBreadcrumb(contractorId);
				const contractorLabel = contractor?.name ?? contractorId;
				return [
					{ label: 'Contractors', href: 'Contractors', clickable: true },
					{
						label: contractorLabel,
						href: `Contractors/${contractorId}/SampleMarkings`,
						clickable: true
					}
				];
			}

			if (!projectId) return crumbs;

			const project = projectStore.projects.find((p) => p.id === projectId);
			const projectLabel = projectBreadcrumbLabel(project, projectId);
			const projectsCrumb = { label: 'Projects', href: 'Home', clickable: true };
			const projectCrumb = {
				label: projectLabel,
				href: `Home/${projectId}`,
				clickable: true
			};

			if (pattern.startsWith('Home/:projectId/Towers/:towerId/Boms') && towerId) {
				const tower = projectStore.towerTypes.find(
					(t: { id: string; towerTypeName: string }) => t.id === towerId
				);
				const towerLabel = tower?.towerTypeName ?? towerId;
				const subtypesHref = `Home/${projectId}/Towers/${towerId}/Boms`;
				const crumbsList = [
					projectsCrumb,
					projectCrumb,
					{ label: 'Tower Types', href: `Home/${projectId}/Towers`, clickable: true },
					{
						label: towerLabel,
						href: subtypesHref,
						clickable: true
					}
				];

				// Subtypes list: … / Tower Types / {tower name} / Subtypes
				if (pattern === 'Home/:projectId/Towers/:towerId/Boms') {
					crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: false });
					return crumbsList;
				}

				if (params.lineageId) {
					const lineageBom = projectStore.bomConfigs.find(
						(b) => b.bomLineageId === params.lineageId || b.id === params.lineageId
					);
					crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
					crumbsList.push({
						label: lineageBom?.bomName ?? params.lineageId,
						href: `Home/${projectId}/Towers/${towerId}/Boms/lineage/${params.lineageId}/Versions`,
						clickable: false
					});
					return crumbsList;
				}

				if (params.bomId) {
					const bom = projectStore.bomConfigs.find((b) => b.id === params.bomId);
					const bomLabel = bom?.bomName ?? params.bomId;
					const bomFileLabel = bom?.bomFileId && bom.bomFile ? bom.bomFile : bomLabel;
					const lineageId = bom?.bomLineageId ?? params.bomId;
					const versionLabel = `V${bom?.version ?? 1}`;

					if (pattern.endsWith('Detail')) {
						crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
						crumbsList.push({
							label: bomLabel,
							href: `Home/${projectId}/Towers/${towerId}/Boms/lineage/${lineageId}/Versions`,
							clickable: true
						});
						crumbsList.push({
							label: versionLabel,
							href: `Home/${projectId}/Towers/${towerId}/Boms/${params.bomId}/Detail`,
							clickable: false
						});
						return crumbsList;
					}

					if (pattern.endsWith('Items')) {
						crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
						crumbsList.push({
							label: bomLabel,
							href: `Home/${projectId}/Towers/${towerId}/Boms/lineage/${lineageId}/Versions`,
							clickable: true
						});
						crumbsList.push({
							label: versionLabel,
							href: `Home/${projectId}/Towers/${towerId}/Boms/${params.bomId}/Detail`,
							clickable: bomFileLabel !== bomLabel
						});
						if (bomFileLabel !== bomLabel) {
							crumbsList.push({ label: bomFileLabel, href: '', clickable: false });
						} else {
							const lastIdx = crumbsList.length - 1;
							crumbsList[lastIdx] = {
								...crumbsList[lastIdx],
								href: '',
								clickable: false
							};
						}
						return crumbsList;
					}

					if (pattern.includes('/DrawingSets/') && params.drawingSetName) {
						const drawingSetLabel = decodeURIComponent(params.drawingSetName);
						crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
						crumbsList.push({
							label: bomLabel,
							href: `Home/${projectId}/Towers/${towerId}/Boms/lineage/${lineageId}/Versions`,
							clickable: true
						});
						crumbsList.push({
							label: versionLabel,
							href: `Home/${projectId}/Towers/${towerId}/Boms/${params.bomId}/Detail`,
							clickable: true
						});
						crumbsList.push({ label: drawingSetLabel, href: '', clickable: false });
						return crumbsList;
					}
				}

				return crumbsList;
			}

			if (pattern.startsWith('Home/:projectId/Stubs/:stubId/Boms') && stubId) {
				const stub = projectStore.stubTypes.find(
					(s: { id: string; stubTypeName: string }) => s.id === stubId
				);
				const stubLabel = stub?.stubTypeName ?? stubId;
				const subtypesHref = `Home/${projectId}/Stubs/${stubId}/Boms`;
				const crumbsList = [
					projectsCrumb,
					projectCrumb,
					{ label: 'Stubs', href: `Home/${projectId}/Stubs`, clickable: true },
					{
						label: stubLabel,
						href: subtypesHref,
						clickable: true
					}
				];

				if (pattern === 'Home/:projectId/Stubs/:stubId/Boms') {
					crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: false });
					return crumbsList;
				}

				if (params.lineageId) {
					const lineageBom = projectStore.bomConfigs.find(
						(b) => b.bomLineageId === params.lineageId || b.id === params.lineageId
					);
					crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
					crumbsList.push({
						label: lineageBom?.bomName ?? params.lineageId,
						href: `Home/${projectId}/Stubs/${stubId}/Boms/lineage/${params.lineageId}/Versions`,
						clickable: false
					});
					return crumbsList;
				}

				if (params.bomId) {
					const bom = projectStore.bomConfigs.find((b) => b.id === params.bomId);
					const bomLabel = bom?.bomName ?? params.bomId;
					const bomFileLabel = bom?.bomFileId && bom.bomFile ? bom.bomFile : bomLabel;
					const lineageId = bom?.bomLineageId ?? params.bomId;
					const versionLabel = `V${bom?.version ?? 1}`;

					if (pattern.endsWith('Detail')) {
						crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
						crumbsList.push({
							label: bomLabel,
							href: `Home/${projectId}/Stubs/${stubId}/Boms/lineage/${lineageId}/Versions`,
							clickable: true
						});
						crumbsList.push({
							label: versionLabel,
							href: `Home/${projectId}/Stubs/${stubId}/Boms/${params.bomId}/Detail`,
							clickable: false
						});
						return crumbsList;
					}

					if (pattern.endsWith('Items')) {
						crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
						crumbsList.push({
							label: bomLabel,
							href: `Home/${projectId}/Stubs/${stubId}/Boms/lineage/${lineageId}/Versions`,
							clickable: true
						});
						crumbsList.push({
							label: versionLabel,
							href: `Home/${projectId}/Stubs/${stubId}/Boms/${params.bomId}/Detail`,
							clickable: bomFileLabel !== bomLabel
						});
						if (bomFileLabel !== bomLabel) {
							crumbsList.push({ label: bomFileLabel, href: '', clickable: false });
						} else {
							const lastIdx = crumbsList.length - 1;
							crumbsList[lastIdx] = {
								...crumbsList[lastIdx],
								href: '',
								clickable: false
							};
						}
						return crumbsList;
					}

					if (pattern.includes('/DrawingSets/') && params.drawingSetName) {
						const drawingSetLabel = decodeURIComponent(params.drawingSetName);
						crumbsList.push({ label: 'Subtypes', href: subtypesHref, clickable: true });
						crumbsList.push({
							label: bomLabel,
							href: `Home/${projectId}/Stubs/${stubId}/Boms/lineage/${lineageId}/Versions`,
							clickable: true
						});
						crumbsList.push({
							label: versionLabel,
							href: `Home/${projectId}/Stubs/${stubId}/Boms/${params.bomId}/Detail`,
							clickable: true
						});
						crumbsList.push({ label: drawingSetLabel, href: '', clickable: false });
						return crumbsList;
					}
				}

				return crumbsList;
			}

			if (pattern === 'Home/:projectId/Releases/:releaseId' && releaseId) {
				const release = projectStore.releases.find(
					(r: { id: string; name: string }) => r.id === releaseId
				);
				const releaseLabel = release?.name ?? releaseId;
				return [
					projectsCrumb,
					projectCrumb,
					{ label: 'Quantity Requirement Sheet', href: `Home/${projectId}/Qrc`, clickable: true },
					{ label: 'Releases', href: `Home/${projectId}/Releases`, clickable: true },
					{
						label: releaseLabel,
						href: `Home/${projectId}/Releases/${releaseId}`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/Releases') {
				return [
					projectsCrumb,
					projectCrumb,
					{ label: 'Quantity Requirement Sheet', href: `Home/${projectId}/Qrc`, clickable: true },
					{
						label: 'Releases',
						href: `Home/${projectId}/Releases`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/Qrc') {
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Quantity Requirement Sheet',
						href: `Home/${projectId}/Qrc`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/DeliverySchedule') {
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Delivery Plan',
						href: `Home/${projectId}/DeliverySchedule`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/DeliverySchedule/DeliverySchedules') {
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Delivery Plan',
						href: `Home/${projectId}/DeliverySchedule`,
						clickable: true
					},
					{
						label: 'Delivery Schedules',
						href: `Home/${projectId}/DeliverySchedule/DeliverySchedules`,
						clickable: true
					}
				];
			}
			if (
				pattern === 'Home/:projectId/DeliverySchedule/DeliverySchedules/:scheduleId' &&
				scheduleId
			) {
				const schedule = projectStore.deliverySchedules.find(
					(row: { id: string; name: string; date: string }) => row.id === scheduleId
				);
				const scheduleLabel = deliveryScheduleLabel(schedule, 'Delivery Schedule');
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Delivery Plan',
						href: `Home/${projectId}/DeliverySchedule`,
						clickable: true
					},
					{
						label: 'Delivery Schedules',
						href: `Home/${projectId}/DeliverySchedule/DeliverySchedules`,
						clickable: true
					},
					{
						label: scheduleLabel,
						href: `Home/${projectId}/DeliverySchedule/DeliverySchedules/${scheduleId}`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/CuttingPlanConfiguration') {
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Cutting Plan',
						href: `Home/${projectId}/CuttingPlanConfiguration`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/OperationsCountConfiguration') {
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Operations Count',
						href: `Home/${projectId}/OperationsCountConfiguration`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/ProductionPlanQrc') {
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Production Plan',
						href: `Home/${projectId}/ProductionPlanQrc`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/ProductionPlans') {
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Production Plan',
						href: `Home/${projectId}/ProductionPlanQrc`,
						clickable: true
					},
					{
						label: 'Production Plans',
						href: `Home/${projectId}/ProductionPlans`,
						clickable: true
					}
				];
			}

			if (pattern === 'Home/:projectId/ProductionPlans/:planId' && params.planId) {
				const plan = projectStore.productionPlans.find(
					(p: { id: string; name: string }) => p.id === params.planId
				);
				const planLabel = plan?.name ?? params.planId;
				return [
					projectsCrumb,
					projectCrumb,
					{
						label: 'Production Plan',
						href: `Home/${projectId}/ProductionPlanQrc`,
						clickable: true
					},
					{
						label: 'Production Plans',
						href: `Home/${projectId}/ProductionPlans`,
						clickable: true
					},
					{
						label: planLabel,
						href: `Home/${projectId}/ProductionPlans/${params.planId}`,
						clickable: false
					}
				];
			}

			return crumbs;
		},
		resolveRouteTitle: (pattern: string, params: Record<string, string>) => {
			if (pattern === 'Home/:projectId' && params.projectId) {
				const proj = projectStore.projects.find((p) => p.id === params.projectId);
				return projectBreadcrumbLabel(proj, params.projectId);
			}
			if (pattern === 'Home/:projectId/Releases/:releaseId' && params.releaseId) {
				const rel = projectStore.releases.find(
					(r: { id: string; name: string }) => r.id === params.releaseId
				);
				return rel ? rel.name : params.releaseId;
			}
			if (
				pattern === 'Home/:projectId/DeliverySchedule/DeliverySchedules/:scheduleId' &&
				params.scheduleId
			) {
				const schedule = projectStore.deliverySchedules.find(
					(row: { id: string; name: string; date: string }) => row.id === params.scheduleId
				);
				return deliveryScheduleLabel(schedule, params.scheduleId);
			}
			if (pattern === 'Home/:projectId/ProductionPlans/:planId' && params.planId) {
				const plan = projectStore.productionPlans.find(
					(p: { id: string; name: string }) => p.id === params.planId
				);
				return plan ? plan.name : params.planId;
			}
			if (pattern === 'Home/:projectId/Towers/:towerId/Boms/:bomId/Items' && params.bomId) {
				const bom = projectStore.bomConfigs.find((b) => b.id === params.bomId);
				if (bom?.bomFileId && bom.bomFile) return bom.bomFile;
				return bom?.bomName ?? params.bomId;
			}
			if (pattern === 'Home/:projectId/Stubs/:stubId/Boms/:bomId/Items' && params.bomId) {
				const bom = projectStore.bomConfigs.find((b) => b.id === params.bomId);
				if (bom?.bomFileId && bom.bomFile) return bom.bomFile;
				return bom?.bomName ?? params.bomId;
			}
			if (pattern.includes('/DrawingSets/') && params.drawingSetName) {
				return decodeURIComponent(params.drawingSetName);
			}
			if (pattern === 'Home/:projectId/Towers/:towerId/Boms' && params.towerId) {
				const tower = projectStore.towerTypes.find(
					(t: { id: string; towerTypeName: string }) => t.id === params.towerId
				);
				return tower ? tower.towerTypeName : params.towerId;
			}
			if (pattern === 'Home/:projectId/Stubs/:stubId/Boms' && params.stubId) {
				const stub = projectStore.stubTypes.find(
					(s: { id: string; stubTypeName: string }) => s.id === params.stubId
				);
				return stub ? stub.stubTypeName : params.stubId;
			}
			return null;
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			if (paramName === 'contractorId') {
				const contractor = getContractorBreadcrumb(paramValue);
				return contractor ? contractor.name : paramValue;
			}
			if (paramName === 'projectId') {
				const proj = projectStore.projects.find((p) => p.id === paramValue);
				return projectBreadcrumbLabel(proj, paramValue);
			}
			if (paramName === 'releaseId') {
				const rel = projectStore.releases.find(
					(r: { id: string; name: string }) => r.id === paramValue
				);
				return rel ? rel.name : paramValue;
			}
			if (paramName === 'scheduleId') {
				const schedule = projectStore.deliverySchedules.find(
					(row: { id: string; name: string; date: string }) => row.id === paramValue
				);
				return deliveryScheduleLabel(schedule, paramValue);
			}
			if (paramName === 'planId') {
				const plan = projectStore.productionPlans.find(
					(p: { id: string; name: string }) => p.id === paramValue
				);
				return plan ? plan.name : paramValue;
			}
			if (paramName === 'bomId') {
				const bom = projectStore.bomConfigs.find(
					(b: { id: string; bomName: string }) => b.id === paramValue
				);
				return bom ? bom.bomName : paramValue;
			}
			if (paramName === 'towerId') {
				const tower = projectStore.towerTypes.find(
					(t: { id: string; towerTypeName: string }) => t.id === paramValue
				);
				return tower ? tower.towerTypeName : paramValue;
			}
			if (paramName === 'stubId') {
				const stub = projectStore.stubTypes.find(
					(s: { id: string; stubTypeName: string }) => s.id === paramValue
				);
				return stub ? stub.stubTypeName : paramValue;
			}
			return paramValue;
		},
		resolveParamHref: (paramName: string, paramValue: string) => {
			if (paramName === 'projectId') {
				return `Home/${paramValue}`;
			}
			return null;
		}
	}
};
