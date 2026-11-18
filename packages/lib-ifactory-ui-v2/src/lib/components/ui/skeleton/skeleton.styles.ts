import { cn } from '$lib/utils/cn';

export function skeletonClass(animated: boolean, className: string): string {
	return cn('rounded-md bg-foreground/10', animated && 'animate-pulse', className);
}
