import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorFromJob, toApiErrorFromBody } from './api-error.js';
import { formatDatahubErrorMessage } from './format-datahub-error.js';
import { formatApiErrorMessage } from './types.js';

const duplicateProjectError =
	'Failed query: insert into "ifactory_core"."proj_projects" ("name", "customer_id", "metadata") values ($1, $2, $3::jsonb) returning * params: MUMBAI - BAISUR 500KV LINE,02d27a72-da8b-4450-aa96-8184190ba68a,{"short_name":"MUMBAI - BAISUR"} ← duplicate key value violates unique constraint "proj_projects_name_unique" [23505] (detail: Key (name)=(MUMBAI - BAISUR 500KV LINE) already exists.)';

describe('formatDatahubErrorMessage', () => {
	it('maps duplicate project names to a user-friendly message', () => {
		expect(formatDatahubErrorMessage(duplicateProjectError)).toBe(
			'A project named "MUMBAI - BAISUR 500KV LINE" already exists.'
		);
	});

	it('maps known API errors to user-friendly messages', () => {
		expect(formatDatahubErrorMessage('Entity not allowed')).toBe(
			'You do not have permission to perform this action.'
		);
		expect(formatDatahubErrorMessage('Not found')).toBe('The requested record was not found.');
	});

	it('maps invalid customer foreign keys to a user-friendly message', () => {
		const raw =
			'Failed query: ... ← insert or update on table "proj_projects" violates foreign key constraint "proj_projects_customer_id_fkey" [23503]';

		expect(formatDatahubErrorMessage(raw)).toBe(
			'The selected customer is invalid or no longer exists.'
		);
	});

	it('falls back to a generic save message for unknown database errors', () => {
		expect(
			formatDatahubErrorMessage('Failed query: ... ← syntax error at or near "foo" [42601]')
		).toBe('Unable to save your changes. Please check your input and try again.');
	});

	it('returns plain validation messages unchanged', () => {
		expect(formatDatahubErrorMessage('Unknown column "foo"')).toBe('Unknown column "foo"');
	});

	it('strips legacy coreFetch wrapper text and returns the server error', () => {
		expect(
			formatDatahubErrorMessage(
				'core POST /api/v2/files failed (413): file exceeds the maximum upload size'
			)
		).toBe('file exceeds the maximum upload size');
	});
});

describe('toApiErrorFromBody', () => {
	it('prefers nested catalog envelope', () => {
		const err = toApiErrorFromBody(
			{
				success: false,
				error: {
					code: 'proj.bom.duplicate_name',
					message: 'A BOM with this name already exists. Please choose a different name.',
					status: 409,
					requestId: 'req-1'
				}
			},
			409
		);
		expect(err).toMatchObject({
			code: 'proj.bom.duplicate_name',
			message: 'A BOM with this name already exists. Please choose a different name.',
			status: 409,
			requestId: 'req-1'
		});
		expect(err.retryable).toBe(false);
	});

	it('maps legacy string errors from HTTP status', () => {
		const err = toApiErrorFromBody({ success: false, error: 'Forbidden' }, 403);
		expect(err.code).toBe('auth.forbidden');
		expect(err.message).toBe('Forbidden');
	});
});

describe('apiErrorFromJob', () => {
	it('resolves ocr.default instead of delivery-wrapper noise', () => {
		const err = apiErrorFromJob({
			job_id: 'j1',
			error: 'max delivery attempts (5) exceeded: sidecar fail: boom',
			metadata: { error_code: 'ocr.default' }
		});
		expect(err.code).toBe('ocr.default');
		expect(err.message).toBe('The scan could not be completed. Please try again.');
	});
});

describe('formatApiErrorMessage', () => {
	it('formats legacy ApiError instances via datahub scraper', () => {
		const error = new ApiError(duplicateProjectError, 200);

		expect(formatApiErrorMessage(error)).toBe(
			'A project named "MUMBAI - BAISUR 500KV LINE" already exists.'
		);
	});

	it('passes through catalog messages without scraping', () => {
		const error = new ApiError({
			code: 'db.unique_violation',
			message: 'This already exists. Please use a different value.',
			status: 409
		});
		expect(formatApiErrorMessage(error)).toBe('This already exists. Please use a different value.');
	});
});
