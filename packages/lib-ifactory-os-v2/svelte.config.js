/** @type {import('@sveltejs/kit').Config} */
const config = {
	package: {
		files: (filepath) => !/\.(md|mdc)$/.test(filepath)
	}
};

export default config;
