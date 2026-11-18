import { describe, expect, it } from 'vitest';
import { jobCardPanelFromCard } from './job-card-display.js';

describe('jobCardPanelFromCard', () => {
	it('reads the rev-2 display keys and the qr string', () => {
		const panel = jobCardPanelFromCard({
			qr: ' M-461 ',
			display: {
				header: { jcSrNo: 'M-461', sets: 3, projectName: 'Nikhil' },
				marks: [{ markNo: 'J57 DA 2619', lengthMm: 3424, operation: 'B' }],
				requisition: [{ section: 'MS ANGLE 45x45x4', quantity: 6 }],
				cuttingPlan: [{ rmId: 'RM-1', markings: 'A1×3', wastePct: 0.9 }],
				schedule: [{ machine: 'ANC-01', qty: 2 }],
				ignored: [{ secret: '<b>no</b>' }]
			},
			artifacts: [{ url: 'https://signed.example/secret' }]
		});

		expect(panel.qr).toBe('M-461');
		expect(panel.header.jcSrNo).toBe('M-461');
		expect(panel.header.sets).toBe('3');
		expect(panel.header.projectName).toBe('Nikhil');
		expect(panel.header.customer).toBe('');
		expect(panel.marks).toEqual([
			{
				id: 'mark-0',
				markNo: 'J57 DA 2619',
				lengthMm: '3424',
				widthMm: '',
				wtPerPieceKg: '',
				totalPcs: '',
				totalWtKg: '',
				holes: '',
				operation: 'B',
				bundles: ''
			}
		]);
		expect(panel.requisition[0]?.section).toBe('MS ANGLE 45x45x4');
		expect(panel.cuttingPlan[0]?.markings).toBe('A1×3');
		expect(panel.cuttingPlan[0]?.wastePct).toBe('0.9');
		expect(panel.schedule[0]?.machine).toBe('ANC-01');
		expect(panel.drawings).toEqual([]);
		expect(JSON.stringify(panel)).not.toContain('signed.example');
		expect(JSON.stringify(panel)).not.toContain('<b>');
	});

	it('builds a drawing path from file id and mime and drops the signed url', () => {
		const panel = jobCardPanelFromCard({
			jobId: 'job-1',
			artifacts: [
				{
					kind: 'drawing',
					markNo: 'J57 DA 2619',
					fileId: 'file-a',
					mime: 'image/png',
					url: 'https://signed.example/secret',
					expiresAt: '2099-01-01T00:00:00.000Z'
				},
				{
					kind: 'drawing',
					markNo: 'J57 DA 2620',
					fileId: 'file-a',
					mime: 'image/jpeg',
					expiresAt: '2000-01-01T00:00:00.000Z'
				}
			]
		});
		expect(panel.drawings[0]).toMatchObject({
			markNo: 'J57 DA 2619',
			fileId: 'file-a',
			ext: 'png',
			dest: 'jobs/job-1/file-a.png',
			src: '/artifacts/jobs/job-1/file-a.png',
			expired: false
		});
		expect(panel.drawings[1]).toMatchObject({
			markNo: 'J57 DA 2620',
			ext: 'jpg',
			src: '',
			expired: true
		});
		expect(JSON.stringify(panel)).not.toContain('signed.example');
	});

	it('returns an empty panel when the card has no display', () => {
		const panel = jobCardPanelFromCard({ jobId: 'job-1', section: 'ISA' });
		expect(panel.qr).toBe('');
		expect(panel.header.jcSrNo).toBe('');
		expect(panel.marks).toEqual([]);
		expect(panel.requisition).toEqual([]);
		expect(panel.cuttingPlan).toEqual([]);
		expect(panel.schedule).toEqual([]);
		expect(panel.drawings).toEqual([]);
	});

	it('skips rows that are not objects', () => {
		const panel = jobCardPanelFromCard({
			display: { marks: ['J57', null, { markNo: 'J57 DA 2620' }] }
		});
		expect(panel.marks.map((row) => row.markNo)).toEqual(['J57 DA 2620']);
	});
});
