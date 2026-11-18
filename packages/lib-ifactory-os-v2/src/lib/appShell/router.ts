export function matchRoute(routes: Record<string, unknown>, link: string, appName: string) {
	const prefixPattern = /^#\/[^/]+\//;
	const strippedLink = link.replace(prefixPattern, '');

	if (strippedLink.length > 0) {
		for (const pattern of Object.keys(routes)) {
			const paramNames: string[] = [];
			const regexPattern = pattern.replace(/:[^/]+/g, (match) => {
				paramNames.push(match.substring(1));
				return '([^/]+)';
			});

			const regex = new RegExp(`^${regexPattern}$`);
			const match = strippedLink.match(regex);

			if (match) {
				const params = paramNames.reduce((obj: Record<string, string>, paramName, index) => {
					obj[paramName] = match[index + 1];
					return obj;
				}, {});

				return {
					matchedPattern: pattern,
					params: params
				};
			}
		}
	} else {
		return {
			matchedPattern: 'Home',
			params: { appName: appName }
		};
	}

	return {
		matchedPattern: null,
		params: {}
	};
}
