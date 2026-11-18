<script lang="ts">
	import { Alert } from '@ifactory/ui-v2';

	type Props = {
		message: string;
	};

	let { message }: Props = $props();
</script>

<Alert variant="error" description={message} />
