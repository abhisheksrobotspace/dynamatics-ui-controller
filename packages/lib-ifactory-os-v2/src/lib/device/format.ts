function formatHmiTimestamp(date: Date): string {
	const day = date.toLocaleString('en-GB', { day: '2-digit' });
	const month = date.toLocaleString('en-GB', { month: 'short' });
	const year = date.getFullYear();
	const time = date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
	return `${day} ${month} ${year} · ${time}`;
}

export function formatHmiSyncTime(date = new Date()): string {
	return formatHmiTimestamp(date);
}
