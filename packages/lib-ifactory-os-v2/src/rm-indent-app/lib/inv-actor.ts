import { user } from '../../lib/os/index.svelte.js';
import type { InvActor } from './inv.types.js';

/** Actor for inv lock / release / apply_upload. Gateway stamps actor.email. */
export function currentInvActor(): InvActor {
	const name =
		(typeof user.name === 'string' && user.name.trim()) ||
		(typeof user.email === 'string' && user.email.trim()) ||
		'ui';
	const id =
		(typeof user.id === 'string' && user.id.trim()) ||
		(typeof user.email === 'string' && user.email.trim()) ||
		'ui';
	return { name, user_id: id };
}
