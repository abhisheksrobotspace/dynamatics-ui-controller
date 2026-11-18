<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Skeleton, Textarea } from '@ifactory/ui-v2';
	import { CURRENT_USER_ID, formatDateTime } from '../../lib/constants.js';
	import { addTicketComment, listTicketComments } from '../../lib/tickets.api.js';
	import { formatUserName } from '../../lib/masters.api.js';
	import { formatErrorMessage, isAbortError } from '../../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../../lib/toast.js';
	import type { TicketComment, UserRef } from '../../lib/types.js';

	type Props = {
		ticketId: number;
		users: UserRef[];
	};

	let { ticketId, users }: Props = $props();

	let comments = $state<TicketComment[]>([]);
	let isLoading = $state(true);
	let isComposerOpen = $state(false);
	let draft = $state('');
	let isSaving = $state(false);

	const userById = $derived(new Map(users.map((user) => [user.id, user])));

	function authorName(comment: TicketComment): string {
		if (comment.user_id == null) return 'Unknown User';
		const user = userById.get(comment.user_id);
		return user ? formatUserName(user) : 'Unknown User';
	}

	onMount(() => {
		const controller = new AbortController();
		listTicketComments(ticketId, controller.signal)
			.then((rows) => (comments = rows))
			.catch((error) => {
				if (!isAbortError(error)) {
					pushErrorToast({
						title: 'Failed to load comments',
						description: formatErrorMessage(error)
					});
				}
			})
			.finally(() => (isLoading = false));
		return () => controller.abort();
	});

	async function saveComment() {
		const text = draft.trim();
		if (!text) return;
		isSaving = true;
		try {
			await addTicketComment(ticketId, text, CURRENT_USER_ID);
			comments = await listTicketComments(ticketId);
			draft = '';
			isComposerOpen = false;
			pushSuccessToast({ title: 'Comment added.' });
		} catch (error) {
			pushErrorToast({ title: 'Failed to add comment', description: formatErrorMessage(error) });
		} finally {
			isSaving = false;
		}
	}
</script>

<section class="overflow-hidden border border-border bg-surface text-foreground">
	<div class="flex items-center justify-between gap-3 px-4 pt-4">
		<h3 class="font-heading text-base font-semibold">Comments</h3>
		<Button size="sm" label="Add" onclick={() => (isComposerOpen = true)} />
	</div>
	<div class="px-4 pt-3 pb-4">
		{#if isLoading}
			<div class="flex flex-col gap-2">
				<Skeleton class="h-10 w-full" />
				<Skeleton class="h-10 w-full" />
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				{#if comments.length === 0 && !isComposerOpen}
					<p class="py-2 text-center text-sm text-muted-foreground">No comments yet.</p>
				{:else}
					<div
						class={`flex flex-col gap-4 ${comments.length > 4 ? 'max-h-56 overflow-y-auto' : ''}`}
					>
						{#each comments as comment (comment.id)}
							<div class="flex gap-3">
								<div
									class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
								>
									{authorName(comment).charAt(0)}
								</div>
								<div class="min-w-0">
									<p class="text-sm font-semibold text-foreground">
										{authorName(comment)}
										<span class="ml-2 text-xs font-normal text-muted-foreground">
											{formatDateTime(comment.created_at)}
										</span>
									</p>
									<p class="text-sm break-words text-muted-foreground">{comment.comment}</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if isComposerOpen}
					<Textarea bind:value={draft} placeholder="Add a comment" rows={3} disabled={isSaving} />
					<div class="flex justify-end gap-2">
						<Button
							variant="outline"
							label="Cancel"
							disabled={isSaving}
							onclick={() => {
								draft = '';
								isComposerOpen = false;
							}}
						/>
						<Button
							label="Save"
							loading={isSaving}
							disabled={!draft.trim()}
							onclick={saveComment}
						/>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>
