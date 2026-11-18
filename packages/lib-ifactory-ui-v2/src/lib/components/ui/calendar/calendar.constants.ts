export const CALENDAR_VIEWS = ['day', 'week', 'month', 'year'] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
	day: 'Day view',
	week: 'Week view',
	month: 'Month view',
	year: 'Year view'
};

export const CALENDAR_EVENT_COLORS = ['orange', 'blue', 'green', 'red', 'gray'] as const;

export type CalendarEventColor = (typeof CALENDAR_EVENT_COLORS)[number];

export type CalendarEvent = {
	id: string | number;
	title: string;
	start: Date;
	/** Defaults to start + 30 minutes when omitted. */
	end?: Date | null;
	/** Secondary line shown where space allows (asset name, location, ...). */
	subtitle?: string;
	/** Optional chip (priority / alert label) on day/week blocks. */
	badge?: string;
	color?: CalendarEventColor;
};

/** Monday-first, matching the factory scheduling convention. */
export const CALENDAR_WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export const CALENDAR_WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Visual height of one hour row in the day/week time grid. */
export const CALENDAR_HOUR_HEIGHT_REM = 3.5;

/** Events shorter than this still render as a readable block. */
export const CALENDAR_MIN_EVENT_MINUTES = 30;

/** Max event pills per month-view cell before collapsing into "+ N more". */
export const CALENDAR_MONTH_MAX_EVENTS = 3;
