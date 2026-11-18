// src/customScripts/breadcrumbBuilder.ts
// Pure functions for building breadcrumb arrays
// Updated to be defensive about percent-encoding and normalize routeTitles keys.

export function titleCaseFromPattern(pattern: string | null | undefined): string {
	if (!pattern) return '';
	// Defensive decode (ignore decode errors)
	let s;
	try {
		s = decodeURIComponent(String(pattern));
	} catch {
		s = String(pattern);
	}

	// Remove leading/trailing slashes and split into meaningful tokens
	const parts = s
		.split('/')
		.filter(Boolean)
		.map((p) => p.replace(/^:/, ''));
	const last = parts.length ? parts[parts.length - 1] : s;

	// Humanize: convert dashes/underscores, split camelCase/PascalCase, then Title Case
	return last
		.replace(/[-_]/g, ' ')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase
		.replace(/\s+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

export function extractParamNamesFromPattern(pattern: string | null | undefined): string[] {
	if (!pattern) return [];
	// decode defensively
	let p: string;
	try {
		p = decodeURIComponent(String(pattern));
	} catch {
		p = String(pattern);
	}
	const names: string[] = [];
	p.replace(/:([^/]+)/g, (m, name) => {
		names.push(name);
		return m;
	});
	return names;
}

export function buildHrefFromRootAndParams(
	root: string,
	paramValues: string[] | null | undefined
): string {
	if (!paramValues || !paramValues.length) return root;
	return [root, ...paramValues].join('/');
}

export interface BreadcrumbOptions {
	rootRouteName?: string;
	data?: unknown;
}

export interface BreadcrumbParams {
	matchedPattern?: string | null;
	params?: Record<string, unknown>;
	routeTitles?: Record<string, string>;
	routes?: Record<string, unknown>;
	resolveParamName?:
		((paramName: string, paramValue: string | undefined, data: unknown) => string | null) | null;
	resolveParamHref?:
		| ((
				paramName: string,
				paramValue: string,
				pattern: string,
				params: Record<string, unknown>
		  ) => string | null)
		| null;
	options?: BreadcrumbOptions;
}

export interface Breadcrumb {
	label: string;
	href: string;
	clickable: boolean;
}

/**
 * buildBreadcrumb
 */
export function buildBreadcrumb({
	matchedPattern,
	params = {},
	routeTitles = {},
	routes = {},
	resolveParamName = null,
	resolveParamHref = null,
	options = {}
}: BreadcrumbParams): Breadcrumb[] {
	const { rootRouteName = 'Home', data = null } = options;

	// Normalize routeTitles map: decode keys so lookups are robust.
	const normalizedRouteTitles: Record<string, string> = {};
	Object.keys(routeTitles || {}).forEach((k) => {
		try {
			normalizedRouteTitles[decodeURIComponent(String(k))] = routeTitles[k];
		} catch {
			normalizedRouteTitles[String(k)] = routeTitles[k];
		}
	});

	const trail: Breadcrumb[] = [];

	// Defensive decode for matchedPattern
	let pattern: string | null | undefined;
	try {
		pattern = matchedPattern ? decodeURIComponent(String(matchedPattern)) : matchedPattern;
	} catch {
		pattern = matchedPattern;
	}

	if (!pattern) {
		// Fallback to root if no pattern
		const rootLabel =
			normalizedRouteTitles[rootRouteName] ?? routeTitles[rootRouteName] ?? rootRouteName;
		return [{ label: rootLabel, href: rootRouteName, clickable: false }];
	}

	// Split pattern into segments to reconstruct the path
	const segments = pattern.split('/').filter(Boolean);

	const currentPathSegments: string[] = [];

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		let segmentLabel: string;
		let segmentValue: string;

		if (segment.startsWith(':')) {
			// It is a parameter, e.g. ":AssetId"
			const paramName = segment.slice(1);
			// Decode param value defensively
			let rawValue = params && params[paramName] !== undefined ? params[paramName] : undefined;
			try {
				if (rawValue !== undefined && rawValue !== null)
					rawValue = decodeURIComponent(String(rawValue));
			} catch {
				// keep raw
			}

			if (rawValue === undefined || rawValue === null) {
				// If param is missing, we can't build a valid href for this step or subsequent steps.
				break;
			}
			segmentValue = String(rawValue);

			// Resolve friendly name
			let friendly: string | null = null;
			if (typeof resolveParamName === 'function') {
				try {
					friendly = resolveParamName(paramName, String(rawValue), data);
				} catch {
					// ignore
				}
			}
			segmentLabel = friendly || segmentValue;
		} else {
			// Static segment, e.g. "Assets" or "Details"
			segmentValue = segment;

			// We reconstruct the pattern up to here for lookup
			const patternSoFar = segments.slice(0, i + 1).join('/');
			const possibleTitle = normalizedRouteTitles[patternSoFar] ?? titleCaseFromPattern(segment);
			segmentLabel = possibleTitle;
		}

		currentPathSegments.push(segmentValue);
		let href = currentPathSegments.join('/');

		// Reconstruct the pattern up to this point to check if it's a registered route
		const patternSoFar = segments.slice(0, i + 1).join('/');

		if (segment.startsWith(':') && typeof resolveParamHref === 'function') {
			const isLast = i === segments.length - 1;
			const routeLabel = normalizedRouteTitles[patternSoFar];
			const isRegisteredRoute = Object.prototype.hasOwnProperty.call(routes, patternSoFar);
			const useRouteLabel = !isLast && isRegisteredRoute && routeLabel;

			if (!useRouteLabel) {
				try {
					const hrefOverride = resolveParamHref(
						segment.slice(1),
						segmentValue,
						patternSoFar,
						params
					);
					if (hrefOverride) href = hrefOverride;
				} catch {
					// ignore
				}
			}
		}

		// Determine if we should create a breadcrumb for this segment:
		const isLast = i === segments.length - 1;
		const isRegisteredRoute = Object.prototype.hasOwnProperty.call(routes, patternSoFar);
		const routeLabel = normalizedRouteTitles[patternSoFar];
		const shouldCreateBreadcrumb = isLast || isRegisteredRoute;

		if (!shouldCreateBreadcrumb) {
			continue;
		}

		if (segment.startsWith(':') && !isLast && isRegisteredRoute && routeLabel) {
			segmentLabel = routeLabel;
		}

		trail.push({
			label: segmentLabel,
			href: href,
			clickable: !isLast
		});
	}

	return trail;
}
