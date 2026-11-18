<script lang="ts">
	import { onMount, onDestroy, setContext } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { draggable } from '@neodrag/svelte';
	import { Button } from '@ifactory/ui-v2';
	import { matchRoute } from './router';
	import MenuBar from './MenuBar.svelte';
	import { buildBreadcrumb, titleCaseFromPattern } from '../customScripts/breadcrumbBuilder.js';
	import {
		canCloseApp,
		canMinimizeApp,
		persistOSState,
		user,
		type AppWindowControls
	} from '$lib/os/index.svelte';
	import {
		APP_DATE_FILTER_CONTEXT,
		APP_INSTANCE_ID_CONTEXT,
		APP_NAME_CONTEXT,
		createDefaultAppDateFilter,
		migrateLegacySharedDateFilter,
		resetSharedDateFilterAfterReload
	} from './appSharedState.js';
	import CloseIcon from '$lib/assets/icons/CloseIcon.svelte';
	import ExternalLinkIcon from '$lib/assets/icons/ExternalLinkIcon.svelte';
	import SidebarToggleIcon from '$lib/assets/icons/SidebarToggleIcon.svelte';

	const initialNavigationDone = new SvelteSet<string>();

	let {
		data,
		menu,
		routes,
		appName,
		appCode,
		displayName,
		accentColor,
		strings,
		sidebar: Sidebar,
		topbarComponent: TopbarComponent,
		lang = 'en',
		close,
		appObj = $bindable(),
		appInstanceId,
		zIndex,
		focus,
		windowControls = { close: true, minimize: true } as AppWindowControls
	} = $props();

	let closeDisabled = $derived(!canCloseApp({ ...appObj, windowControls }));
	let minimizeDisabled = $derived(!canMinimizeApp({ ...appObj, windowControls }));
	let sidebarToggleDisabled = $derived(!Sidebar);
	let isDraggable = $derived(windowControls.draggable !== false);

	let params = $state({});
	let rootRouteName = 'Home';
	// Defer first render until the initial route (from hash / restored state) is resolved.
	let CurrentView = $state<(typeof routes)[string] | null>(null);
	let appContainer = $state<HTMLElement | null>(null);

	// svelte-ignore state_referenced_locally
	let routeTitles = $state(menu?.routeTitles ? { ...menu.routeTitles } : {});
	// svelte-ignore state_referenced_locally
	let resolveParamName = menu?.resolveParamName ? menu.resolveParamName : null;
	// svelte-ignore state_referenced_locally
	let resolveParamHref = menu?.resolveParamHref ? menu.resolveParamHref : null;

	appObj.sharedDateFilter ??= createDefaultAppDateFilter(user.activeFactory ?? null);
	if (
		appObj.sharedDateFilter.selectedFactoryId === undefined ||
		appObj.sharedDateFilter.selectedFactoryId === null
	) {
		appObj.sharedDateFilter.selectedFactoryId = user.activeFactory ?? null;
	}
	migrateLegacySharedDateFilter(appObj.sharedDateFilter);
	if (resetSharedDateFilterAfterReload(appObj.sharedDateFilter)) {
		persistOSState();
	}
	setContext(APP_DATE_FILTER_CONTEXT, appObj.sharedDateFilter);
	setContext(APP_INSTANCE_ID_CONTEXT, appInstanceId);
	setContext(APP_NAME_CONTEXT, appName);
	appObj.sidebarOpen ??= false;

	let currentRoute = $state(rootRouteName);
	let currentTitle = $state(
		routeTitles[rootRouteName] ?? titleCaseFromPattern(rootRouteName) ?? rootRouteName
	);
	let breadcrumbs = $state<{ label: string; href?: string; clickable?: boolean }[]>([]);
	let isRoutePreparing = $state(false);
	let isBootstrapping = $state(true);
	let activeNavigationController = $state<AbortController | null>(null);

	let _onHashChange: () => void;

	onMount(() => {
		appContainer = document.getElementById(appInstanceId);
		if (appContainer) {
			applyTransition();
			appContainer.addEventListener('resize', disableTransition);
		}

		const hash = window.location.hash || '';
		let decodedHash = hash;
		try {
			decodedHash = decodeURIComponent(hash);
		} catch {
			/* ignore */
		}

		const prefix = `#/${appName}/`;

		_onHashChange = () => {
			const h = window.location.hash || '';
			let dh = h;
			try {
				dh = decodeURIComponent(h);
			} catch {
				/* ignore */
			}

			if (dh.startsWith(prefix)) {
				try {
					navigateTo(dh.slice(prefix.length) || rootRouteName);
				} catch {
					navigateTo(rootRouteName);
				}
			}
		};
		// Always listen — remounts must not skip this (same appInstanceId stays in initialNavigationDone).
		window.addEventListener('hashchange', _onHashChange);

		let initial = appObj.currentRoute || rootRouteName;

		if (!appObj.currentRoute && decodedHash.startsWith(prefix)) {
			try {
				initial = decodedHash.slice(prefix.length) || rootRouteName;
			} catch {
				initial = rootRouteName;
			}
		} else if (!appObj.currentRoute && hash.startsWith('#/')) {
			try {
				const parts = decodeURIComponent(hash.slice(2)).split('/');
				if (parts[0] === appName) {
					initial = parts.slice(1).join('/') || rootRouteName;
				}
			} catch {
				initial = rootRouteName;
			}
		}

		if (initialNavigationDone.has(appInstanceId)) {
			// Remount of an existing window — restore view from currentRoute without re-running boot.
			void (async () => {
				try {
					await _navigateToInternal(appObj.currentRoute || initial);
				} catch (error) {
					if (error instanceof DOMException && error.name === 'AbortError') {
						return;
					}
					console.error('Navigation error:', error);
					CurrentView = routes[rootRouteName] ?? routes.Home;
					currentRoute = rootRouteName;
				} finally {
					isBootstrapping = false;
				}
			})();
			return;
		}
		initialNavigationDone.add(appInstanceId);

		void (async () => {
			try {
				await _navigateToInternal(initial);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				console.error('Navigation error:', error);
				CurrentView = routes[rootRouteName] ?? routes.Home;
				params = {};
				currentRoute = rootRouteName;
				currentTitle =
					routeTitles[rootRouteName] ?? titleCaseFromPattern(rootRouteName) ?? rootRouteName;
				breadcrumbs = [{ label: currentTitle, href: rootRouteName, clickable: false }];
				window.history.replaceState(null, '', `#/${appName}/${encodeURIComponent(rootRouteName)}`);
			} finally {
				isBootstrapping = false;
			}
		})();
	});

	onDestroy(() => {
		if (_onHashChange) window.removeEventListener('hashchange', _onHashChange);
		activeNavigationController?.abort();
	});

	function applyTransition() {
		if (appContainer)
			appContainer.style.transition = 'transform 0.5s ease, height 0.5s ease, width 0.5s ease';
	}

	function disableTransition() {
		if (appContainer) {
			appContainer.style.transition = 'none';
			setTimeout(() => {
				applyTransition();
			}, 200);
		}
	}

	$effect(() => {
		if (appContainer && zIndex !== undefined && zIndex !== null) {
			appContainer.style.zIndex = zIndex.toString();
		}
	});

	function minimise() {
		appObj.minimised = true;
		persistOSState();
	}

	function navigateTo(href: string) {
		void _navigateToInternal(href).catch((error) => {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
			console.error('Navigation error:', error);
			CurrentView = routes[rootRouteName] ?? routes.Home;
			params = {};
			currentRoute = rootRouteName;
			currentTitle =
				routeTitles[rootRouteName] ?? titleCaseFromPattern(rootRouteName) ?? rootRouteName;
			breadcrumbs = [{ label: currentTitle, href: rootRouteName, clickable: false }];
			window.history.replaceState(null, '', `#/${appName}/${encodeURIComponent(rootRouteName)}`);
		});
	}

	async function _navigateToInternal(href: string) {
		activeNavigationController?.abort();
		const navigationController = new AbortController();
		activeNavigationController = navigationController;

		const appHashPrefix = `#/${appName}/`;
		const encodedAppHashPrefix = `#/${encodeURIComponent(appName)}/`;
		const decodedAppHashPrefix = `#/${decodeURIComponent(appName)}/`;

		if (typeof href === 'string') {
			if (href.startsWith(appHashPrefix)) {
				href = href.slice(appHashPrefix.length) || rootRouteName;
			} else if (href.startsWith(encodedAppHashPrefix)) {
				href = href.slice(encodedAppHashPrefix.length) || rootRouteName;
			} else if (href.startsWith(decodedAppHashPrefix)) {
				href = href.slice(decodedAppHashPrefix.length) || rootRouteName;
			} else if (href.startsWith('#/')) {
				href = href.slice(2);
			} else if (href.startsWith('#')) {
				href = href.slice(1);
			}
		}

		if (!href) href = rootRouteName;
		try {
			href = decodeURIComponent(String(href));
		} catch {
			href = String(href);
		}
		href = href.replace(/^\/+/, '');

		const newView = matchRoute(routes, href, appName);

		if (newView && newView.matchedPattern) {
			const decodedParams: Record<string, string> = {};
			Object.keys(newView.params || {}).forEach((k) => {
				try {
					decodedParams[k] = decodeURIComponent(String(newView.params[k]));
				} catch {
					decodedParams[k] = newView.params[k];
				}
			});

			let decodedPattern: string;
			try {
				decodedPattern = decodeURIComponent(newView.matchedPattern);
			} catch {
				decodedPattern = newView.matchedPattern;
			}

			params = decodedParams;

			// Mount the page immediately so it can show its own skeleton while
			// prepareRoute resolves breadcrumb labels (project/tower/bom names).
			CurrentView = routes[newView.matchedPattern] ?? routes[rootRouteName] ?? CurrentView;
			currentRoute = href;
			appObj.currentRoute = href;

			const patternSegments = decodedPattern.split('/');
			const currentRootSegment = patternSegments[0] || rootRouteName;
			let title =
				routeTitles[decodedPattern] ?? routeTitles[href] ?? routeTitles[newView.matchedPattern];
			if (!title && decodedPattern !== rootRouteName) {
				title = titleCaseFromPattern(decodedPattern);
			}
			currentTitle = title ?? decodedPattern ?? href;

			isRoutePreparing = true;
			try {
				if (typeof menu?.prepareRoute === 'function') {
					await menu.prepareRoute(decodedPattern, decodedParams, navigationController.signal);
				}

				breadcrumbs = buildBreadcrumb({
					matchedPattern: newView.matchedPattern,
					params: decodedParams,
					routeTitles,
					routes,
					resolveParamName,
					resolveParamHref,
					options: { rootRouteName: currentRootSegment, data }
				});

				if (typeof menu?.postProcessBreadcrumbs === 'function') {
					breadcrumbs = menu.postProcessBreadcrumbs(breadcrumbs, decodedPattern, decodedParams);
				}

				const isNestedUnderRoot =
					decodedPattern === rootRouteName || decodedPattern.startsWith(`${rootRouteName}/`);

				if (isNestedUnderRoot && decodedPattern !== rootRouteName) {
					const rootLabel =
						routeTitles[rootRouteName] ?? titleCaseFromPattern(rootRouteName) ?? rootRouteName;
					const firstHref = breadcrumbs[0]?.href ?? '';
					// Only prepend Home when the trail still sits under Home. postProcess may
					// replace with a different root (e.g. RMI replan → Stock Assignment / Lock).
					const trailUnderHome =
						!firstHref || firstHref === rootRouteName || firstHref.startsWith(`${rootRouteName}/`);
					if (trailUnderHome && breadcrumbs[0]?.label !== rootLabel) {
						breadcrumbs.unshift({ label: rootLabel, href: rootRouteName, clickable: true });
					}
				}

				if (breadcrumbs.length) {
					const lastPatternSegment = patternSegments[patternSegments.length - 1];
					const isLastSegmentParam = lastPatternSegment && lastPatternSegment.startsWith(':');
					const routeTitleOverride =
						routeTitles[decodedPattern] ?? routeTitles[newView.matchedPattern];

					if (routeTitleOverride) {
						if (isLastSegmentParam) {
							breadcrumbs.push({
								label: routeTitleOverride,
								href: href,
								clickable: false
							});
						} else {
							breadcrumbs[breadcrumbs.length - 1].label = routeTitleOverride;
						}
					}

					const breadcrumbParent = menu?.breadcrumbParents?.[decodedPattern];
					if (breadcrumbParent && breadcrumbs.length > 0) {
						const parentHref =
							typeof breadcrumbParent.href === 'function'
								? breadcrumbParent.href(decodedParams)
								: breadcrumbParent.href;
						breadcrumbs.splice(breadcrumbs.length - 1, 0, {
							label: breadcrumbParent.label,
							href: parentHref,
							clickable: true
						});
					}

					const lastIdx = breadcrumbs.length - 1;
					breadcrumbs = breadcrumbs.map((c, i) => ({
						...c,
						clickable: i === lastIdx ? false : c.clickable !== false
					}));
				}

				if (typeof menu?.resolveRouteTitle === 'function') {
					const resolvedTitle = menu.resolveRouteTitle(decodedPattern, decodedParams);
					if (resolvedTitle) {
						currentTitle = resolvedTitle;
					}
				}
				window.history.replaceState(null, '', `#/${appName}/${encodeURI(href)}`);
				persistOSState();
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				throw error;
			} finally {
				isRoutePreparing = false;
			}
		} else {
			CurrentView = routes[rootRouteName] ?? routes.Home;
			params = {};
			currentRoute = rootRouteName;
			appObj.currentRoute = rootRouteName;
			currentTitle =
				routeTitles[rootRouteName] ?? titleCaseFromPattern(rootRouteName) ?? rootRouteName;
			breadcrumbs = [{ label: currentTitle, href: rootRouteName, clickable: false }];
			window.history.replaceState(null, '', `#/${appName}/${encodeURIComponent(rootRouteName)}`);
			persistOSState();
		}
	}

	function onclick(event: MouseEvent) {
		const anchor = (event.target as HTMLElement).closest?.('a');
		if (
			!anchor ||
			anchor.target ||
			anchor.hasAttribute('download') ||
			anchor.getAttribute('rel') === 'external'
		)
			return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

		const href = anchor.getAttribute('href');
		if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;

		const looksInternal = href.startsWith(rootRouteName) || !/^[a-zA-Z]+:/.test(href);
		if (!looksInternal) return;

		event.preventDefault();
		navigateTo(href);
	}

	function onmousedown() {
		focus();
	}
</script>

<div
	class="absolute flex h-full max-h-full min-h-[50vh] w-full max-w-full min-w-[50vw] overflow-hidden border-[0.5px] border-[#1616161f] bg-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)]"
	class:resize={isDraggable}
	class:hidden={appObj.minimised}
	id={appInstanceId}
	use:draggable={{
		handle: '.menubar',
		applyUserSelectHack: true,
		bounds: { top: 0, left: -1000, bottom: -800, right: -1000 },
		disabled: !isDraggable
	}}
	{onmousedown}
	{onclick}
	role="presentation"
>
	<div class="flex h-full w-full flex-col overflow-hidden text-[#222222]">
		<!-- ── Top: Full-width TopBar ── -->
		{#if windowControls.menuBar !== false}
			<MenuBar
				{appName}
				{appCode}
				{displayName}
				{accentColor}
				{breadcrumbs}
				isLoading={isBootstrapping || isRoutePreparing}
			>
				{#snippet leftControls()}
					<div
						class="flex h-[48px] shrink-0 items-center border-r-[0.5px] border-[rgba(34,34,34,0.12)] border-b-[0.5px] p-2 transition-[width,background-color] duration-200 ease-linear {appObj.sidebarOpen
							? 'w-60 bg-[#FAFAFA]'
							: 'w-[116px] bg-white'}"
					>
						<div class="flex h-[32px] w-[100px] items-center gap-[2px]">
							<Button
								variant="ghost"
								size="icon"
								icon={CloseIcon}
								onclick={close}
								disabled={closeDisabled}
								title="Close"
								aria-label="Close"
								class="h-8 w-8 rounded-md text-[#09090b] hover:bg-[#0000000a]"
								iconClass="stroke-[1.25px] text-[#7a7a7a] w-[14px] h-[14px]"
							/>
							<Button
								variant="ghost"
								size="icon"
								icon={ExternalLinkIcon}
								onclick={minimise}
								disabled={minimizeDisabled}
								title="Minimize"
								aria-label="Minimize"
								class="h-8 w-8 rounded-md text-[#09090b] hover:bg-[#0000000a]"
								iconClass="stroke-[1.25px] text-[#7a7a7a] w-[14px] h-[14px]"
							/>
							<Button
								variant="ghost"
								size="icon"
								icon={SidebarToggleIcon}
								onclick={() => {
									appObj.sidebarOpen = !appObj.sidebarOpen;
									persistOSState();
								}}
								disabled={sidebarToggleDisabled}
								title="Toggle Sidebar"
								aria-label="Toggle Sidebar"
								class="h-8 w-8 rounded-md text-[#09090b] hover:bg-[#0000000a]"
								iconClass="stroke-[1.25px] text-[#7a7a7a] w-[14px] h-[14px]"
							/>
						</div>
					</div>
				{/snippet}
				{#snippet rightControls()}
					{#if TopbarComponent}
						<TopbarComponent {currentRoute} {params} {data} />
					{/if}
				{/snippet}
			</MenuBar>
		{/if}

		<!-- ── Bottom: App Sidebar + Content ── -->
		<div class="flex flex-1 flex-row min-h-0 overflow-hidden bg-white">
			{#if Sidebar}
				<Sidebar
					{strings}
					{lang}
					{currentRoute}
					{data}
					{appName}
					{navigateTo}
					bind:open={appObj.sidebarOpen}
				/>
			{/if}

			<div id="{appInstanceId}-content" class="flex-1 overflow-auto bg-white p-0">
				{#if CurrentView}
					<CurrentView {params} {data} {strings} {lang} />
				{/if}
			</div>
		</div>
	</div>
</div>
