import { formatDdMmYyyy, parseDdMmYyyy } from '@ifactory/ui-v2';

/** `YYYY-MM-DDTHH:mm` in browser local timezone. */
export function utcIsoToDateTimeLocal(iso: string): string {
	const d = new Date(iso.trim());
	if (Number.isNaN(d.getTime())) {
		return utcIsoToDateTimeLocal(new Date().toISOString());
	}
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Encode datetime-local wall time with explicit zone offset. */
export function dateTimeLocalToOffsetIso(local: string): string | null {
	const s = local.trim();
	if (!s) return null;
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) return null;
	const pad = (n: number) => String(n).padStart(2, '0');
	const y = d.getFullYear();
	const mo = pad(d.getMonth() + 1);
	const da = pad(d.getDate());
	const h = pad(d.getHours());
	const mi = pad(d.getMinutes());
	const se = pad(d.getSeconds());
	const offMin = -d.getTimezoneOffset();
	const sign = offMin >= 0 ? '+' : '-';
	const ad = Math.abs(offMin);
	const oh = pad(Math.floor(ad / 60));
	const omm = pad(ad % 60);
	return `${y}-${mo}-${da}T${h}:${mi}:${se}${sign}${oh}:${omm}`;
}

/** Convert dd/mm/yyyy to offset ISO at local midnight. */
export function ddMmYyyyToOffsetIso(value: string): string | null {
	const date = parseDdMmYyyy(value);
	if (!date) return null;
	date.setHours(0, 0, 0, 0);
	return dateTimeLocalToOffsetIso(utcIsoToDateTimeLocal(date.toISOString()));
}

export function isoToDdMmYyyy(iso: string): string {
	const d = new Date(iso.trim());
	if (Number.isNaN(d.getTime())) return formatDdMmYyyy(new Date());
	return formatDdMmYyyy(d);
}

export function formatSimulationStartLabel(isoOrMs: string | number): string {
	const d = new Date(isoOrMs);
	if (Number.isNaN(d.getTime())) return String(isoOrMs);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function timelineHoursFromStart(startMs: number, count = 6, stepHours = 1): string[] {
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		const d = new Date(startMs + i * stepHours * 60 * 60_000);
		const pad = (n: number) => String(n).padStart(2, '0');
		out.push(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
	}
	return out;
}

export function defaultSimulationStartIso(anchorMs: number): string {
	return (
		dateTimeLocalToOffsetIso(utcIsoToDateTimeLocal(new Date(anchorMs).toISOString())) ??
		new Date(anchorMs).toISOString()
	);
}
