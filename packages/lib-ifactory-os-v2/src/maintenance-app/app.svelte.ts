import Tickets from './routes/Tickets.svelte';
import OtherTickets from './routes/OtherTickets.svelte';
import TicketUpdateLogs from './routes/TicketUpdateLogs.svelte';
import AddTicket from './routes/AddTicket.svelte';
import TicketDetails from './routes/TicketDetails.svelte';
import Alerts from './routes/Alerts.svelte';
import AddAlert from './routes/AddAlert.svelte';
import Instructions from './routes/Instructions.svelte';
import AddInstruction from './routes/AddInstruction.svelte';
import Calendar from './routes/Calendar.svelte';
import AddEvent from './routes/AddEvent.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import { getTicketLabel } from './lib/tickets.api.js';

export const app = {
	appName: 'Maintenance',
	appCode: 'MNT',
	displayName: 'Maintenance',
	dockColor: '#EF4444',
	icon: '/assets/icons/maintenance.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	routes: {
		Home: Tickets,
		Tickets: Tickets,
		Other: OtherTickets,
		TicketUpdateLogs: TicketUpdateLogs,
		'Tickets/AddTicket': AddTicket,
		'Tickets/:ticketId': AddTicket,
		'Tickets/Details/:ticketId': TicketDetails,
		Alerts: Alerts,
		'Alerts/AddAlert': AddAlert,
		'Alerts/:alertId': AddAlert,
		Instructions: Instructions,
		'Instructions/AddInstruction': AddInstruction,
		'Instructions/:instructionId': AddInstruction,
		Calendar: Calendar,
		'Calendar/AddEvent': AddEvent,
		'Calendar/:eventId': AddEvent
	},
	menu: {
		routeTitles: {
			Home: 'Tickets',
			Tickets: 'Tickets',
			Other: 'Tickets',
			TicketUpdateLogs: 'Tickets',
			'Tickets/AddTicket': 'Add Ticket',
			'Tickets/:ticketId': 'Edit Ticket',
			'Tickets/Details/:ticketId': 'Ticket Details',
			Alerts: 'Alerts',
			'Alerts/AddAlert': 'Add Alert',
			'Alerts/:alertId': 'Edit Alert',
			Instructions: 'Instructions',
			'Instructions/AddInstruction': 'Add Instruction',
			'Instructions/:instructionId': 'Edit Instruction',
			Calendar: 'Calendar',
			'Calendar/AddEvent': 'Add Event',
			'Calendar/:eventId': 'Edit Event'
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			if (paramName === 'ticketId') {
				return getTicketLabel(paramValue);
			}
			return paramValue;
		}
	}
};
