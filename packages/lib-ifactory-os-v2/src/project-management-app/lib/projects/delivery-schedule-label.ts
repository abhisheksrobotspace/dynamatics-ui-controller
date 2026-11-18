export function deliveryScheduleLabel(
	schedule: { name?: string; date?: string } | undefined,
	fallback: string
): string {
	if (!schedule) return fallback;
	const name = schedule.name?.trim();
	const date = schedule.date?.trim();
	if (name && date) return `${name} - ${date}`;
	return name || date || fallback;
}
