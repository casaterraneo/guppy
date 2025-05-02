import { Hono } from 'hono';

const app = new Hono().get('/', async c => {
	if (c.req.header('upgrade') !== 'websocket') {
		return c.text('Expected Upgrade: websocket', 426);
	}

	const user = c.get('user');
	console.log('[user.name for DO]', user?.name);
	if (!user) {
		console.log('No user found');
		return c.text('No user found', 401);
	}
	console.log('[user.name for DO]', user.name);

	const id = c.env.TRIS_RECEIVER.idFromName(user.name);
	const stub = c.env.TRIS_RECEIVER.get(id);

	return stub.fetch(c.req.raw);
});

export default app;
