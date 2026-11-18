import { v1 as uuidv1 } from 'uuid';

export function getUUID(): string {
	return uuidv1();
}
