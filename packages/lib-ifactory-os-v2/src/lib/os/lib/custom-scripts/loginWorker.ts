self.onmessage = async (event: MessageEvent) => {
	const { operatorId, password, operators } = event.data as {
		operatorId?: string;
		password?: string;
		operators?: Record<string, { id?: string; name?: string; password?: string }>;
	};

	if (!operatorId || !password || typeof operators !== 'object') {
		self.postMessage({ success: false, reason: 'Missing fields or invalid data' });
		return;
	}

	const operatorIdLower = operatorId.toLowerCase();
	let matchedKey: string | null = null;
	let operator: { id?: string; name?: string; password?: string } | undefined;
	for (const key in operators) {
		if (key.toLowerCase() === operatorIdLower) {
			matchedKey = key;
			operator = operators[key];
			break;
		}
	}

	if (!operator || !matchedKey) {
		self.postMessage({ success: false, reason: 'Operator not found' });
		return;
	}

	const hashedInput = await hashPassword(password);
	const storedPassword = String(operator.password ?? '')
		.trim()
		.toLowerCase();
	const isMatch = hashedInput === storedPassword;

	if (!isMatch) {
		self.postMessage({ success: true, match: false, reason: 'Invalid credentials' });
		return;
	}

	/**
	 * `oid` is the operator's uuid — `operators.operator_id` as the cloud pushed it — and it lives
	 * in the slice row's `id`, NOT in the key the row is filed under.
	 *
	 * The key is the login name, and it used to be what went on the wire. Every PMS schema declares
	 * `oid` as a uuid, so the controller refused each event carrying it before publishing: 7001,
	 * 7003, 7004, 14001, 14002 and every job event. A machine that looked silent was in fact
	 * building correct messages and dropping all of them.
	 */
	const oid = operator.id;
	if (!oid) {
		self.postMessage({
			success: false,
			reason: 'This operator has no id yet — the cloud has not pushed the operator list'
		});
		return;
	}

	self.postMessage({
		success: true,
		match: true,
		/** The uuid the device reports production against. */
		operatorOid: oid,
		name: operator.name ?? null,
		reason: 'Login successful'
	});
};

async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password.trim());
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
