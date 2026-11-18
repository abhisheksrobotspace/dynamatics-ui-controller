<script lang="ts">
	import { KeyValueCard } from '@ifactory/ui-v2';

	type Props = {
		jobId: string;
		markNo: string;
		/** Full job id for hover when value is truncated. */
		jobIdTitle?: string;
		class?: string;
	};

	let { jobId, markNo, jobIdTitle, class: className = '' }: Props = $props();
</script>

<!-- pl2-job-running job-header: Job ID + Mark No, each half width -->
<div class="relative box-border h-full w-full min-w-0 {className}">
	<div class="absolute top-0 bottom-[12px] left-0 w-1/2 min-w-0 overflow-hidden pr-4">
		<KeyValueCard
			label="Job ID"
			value={jobId}
			title={jobIdTitle ?? jobId}
			class="box-border flex h-full w-full min-w-0 flex-col items-start justify-between overflow-hidden border-0 bg-transparent p-0 shadow-none"
			labelClass="font-heading text-xl font-bold uppercase tracking-[0.5px] text-muted"
			valueClass="block w-full min-w-0 truncate font-body text-[36px] font-bold leading-[47px] text-foreground"
		/>
	</div>
	<div class="absolute top-0 bottom-[12px] left-1/2 right-0 min-w-0 overflow-hidden pl-4">
		<KeyValueCard
			label="Mark No"
			value={markNo}
			title={markNo}
			class="box-border flex h-full w-full min-w-0 flex-col items-start justify-between overflow-hidden border-0 bg-transparent p-0 shadow-none"
			labelClass="font-heading text-xl font-bold uppercase tracking-[0.5px] text-muted"
			valueClass="block w-full min-w-0 truncate font-body text-[36px] font-bold leading-[47px] text-foreground"
		/>
	</div>
</div>
