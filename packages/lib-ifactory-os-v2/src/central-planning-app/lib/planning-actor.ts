import { user } from '../../lib/os/index.svelte.js';

/** Email stamped on `pln_*` created_by / updated_by / sent_by (falls back to name, then `ui`). */
export function getPlanningActor(): string {
	const email = typeof user.email === 'string' ? user.email.trim() : '';
	if (email) return email;
	const name = typeof user.name === 'string' ? user.name.trim() : '';
	if (name) return name;
	return 'ui';
}
