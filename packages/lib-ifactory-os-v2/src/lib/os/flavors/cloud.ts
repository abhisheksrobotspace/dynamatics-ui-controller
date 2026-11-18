import Lockscreen from '../Lockscreen.svelte';
import SetPassword from '../SetPassword.svelte';
import type { OsFlavor } from './types';

export { apps } from '../../../routes/osConfig';

export const flavor: OsFlavor = {
	id: 'cloud',
	layout: 'gate',
	Lockscreen,
	SetPassword,
	Overlays: []
};
