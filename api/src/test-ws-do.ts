import { Hono } from 'hono';

const app = new Hono().get('/', async c => {
	if (c.req.header('upgrade') !== 'websocket') {
		return c.text('Expected Upgrade: websocket', 426);
	}

	const id = c.env.WEBHOOK_RECEIVER.idFromName('WEBHOOK_RECEIVER');
	const stub = c.env.WEBHOOK_RECEIVER.get(id);

	return stub.fetch(c.req.raw);
});

export default app;
