<script lang="ts">
	import { onMount } from 'svelte';
	import { File, FileText, Trash2, Video } from '@lucide/svelte';
	import { Button, ConfirmationDialog, Skeleton } from '@ifactory/ui-v2';
	import {
		deleteTicketAttachment,
		listTicketFiles,
		uploadTicketAttachment
	} from '../../lib/tickets.api.js';
	import { formatErrorMessage, isAbortError } from '../../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../../lib/toast.js';
	import type { TicketFile } from '../../lib/types.js';

	/** v1 upload constraints (5 MB; images, pdf, mp4). */
	const MAX_FILE_SIZE = 5 * 1024 * 1024;
	const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'video/mp4'];

	type Props = {
		ticketId: number;
	};

	let { ticketId }: Props = $props();

	let files = $state<TicketFile[]>([]);
	let isLoading = $state(true);
	let isUploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	type FileCategory = 'image' | 'video' | 'document' | 'other';

	function categoryOf(type: string): FileCategory {
		if (type.startsWith('image/')) return 'image';
		if (type.startsWith('video/')) return 'video';
		if (
			type === 'application/pdf' ||
			type.includes('word') ||
			type.includes('excel') ||
			type.includes('presentation') ||
			type.startsWith('text/')
		) {
			return 'document';
		}
		return 'other';
	}

	onMount(() => {
		const controller = new AbortController();
		listTicketFiles(ticketId, controller.signal)
			.then((rows) => (files = rows))
			.catch((error) => {
				if (!isAbortError(error)) {
					pushErrorToast({
						title: 'Failed to load attachments',
						description: formatErrorMessage(error)
					});
				}
			})
			.finally(() => (isLoading = false));
		return () => controller.abort();
	});

	async function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		if (file.size > MAX_FILE_SIZE) {
			pushErrorToast({ title: 'File too large', description: 'Maximum size is 5MB.' });
			return;
		}
		if (!ALLOWED_TYPES.includes(file.type)) {
			pushErrorToast({
				title: 'Invalid file type',
				description: 'Allowed: JPEG, PNG, PDF, MP4.'
			});
			return;
		}

		isUploading = true;
		try {
			await uploadTicketAttachment(ticketId, file);
			files = await listTicketFiles(ticketId);
			pushSuccessToast({ title: 'File uploaded.' });
		} catch (error) {
			pushErrorToast({ title: 'Upload failed', description: formatErrorMessage(error) });
		} finally {
			isUploading = false;
		}
	}

	// --- Delete confirmation ---
	let filePendingDelete = $state<TicketFile | null>(null);
	let isDeleteDialogOpen = $state(false);

	async function confirmDelete() {
		const target = filePendingDelete;
		filePendingDelete = null;
		if (!target) return;
		try {
			await deleteTicketAttachment(ticketId, target.id);
			files = files.filter((file) => file.id !== target.id);
			pushSuccessToast({ title: 'Attachment deleted.' });
		} catch (error) {
			pushErrorToast({ title: 'Delete failed', description: formatErrorMessage(error) });
		}
	}
</script>

<section class="overflow-hidden border border-border bg-surface text-foreground">
	<div class="flex items-center justify-between gap-3 px-4 pt-4">
		<h3 class="font-heading text-base font-semibold">Attachments</h3>
		<Button size="sm" label="Add" loading={isUploading} onclick={() => fileInput?.click()} />
	</div>

	<input
		bind:this={fileInput}
		type="file"
		class="hidden"
		accept={ALLOWED_TYPES.join(',')}
		onchange={handleFileChange}
	/>

	<div class="px-4 pt-3 pb-4">
		{#if isLoading}
			<div class="flex flex-col gap-2">
				<Skeleton class="h-12 w-full" />
			</div>
		{:else if files.length === 0}
			<p class="py-6 text-center text-sm text-muted-foreground">
				No attachments yet. Click Add to upload.
			</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each files as file (file.id)}
					{@const category = categoryOf(file.type)}
					<div
						class="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
					>
						<div class="flex min-w-0 items-center gap-2">
							{#if category === 'image'}
								<img
									src={file.url}
									alt={file.name}
									class="size-10 shrink-0 rounded-md object-cover"
								/>
							{:else if category === 'video'}
								<div
									class="flex size-10 shrink-0 items-center justify-center rounded-md bg-purple-50 text-purple-600"
								>
									<Video class="size-5" aria-hidden="true" />
								</div>
							{:else if category === 'document'}
								<div
									class="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600"
								>
									<FileText class="size-5" aria-hidden="true" />
								</div>
							{:else}
								<div
									class="flex size-10 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-muted-foreground"
								>
									<File class="size-5" aria-hidden="true" />
								</div>
							{/if}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- object/file URL, not an app route -->
							<a
								href={file.url}
								class="truncate font-medium text-foreground hover:text-primary hover:underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{file.name || 'Unnamed File'}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</div>
						<Button
							variant="ghost"
							size="icon"
							icon={Trash2}
							aria-label="Delete attachment"
							class="size-8 shrink-0"
							iconClass="size-4"
							onclick={() => {
								filePendingDelete = file;
								isDeleteDialogOpen = true;
							}}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete attachment?"
	description="This removes the file from the ticket."
	confirmLabel="Delete"
	confirmVariant="danger"
	onConfirm={() => void confirmDelete()}
	onCancel={() => (filePendingDelete = null)}
/>
