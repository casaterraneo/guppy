import { Hono } from 'hono';

const app = new Hono()
	.get('/', async c => {
		const env = c.env;
		const id = env.COUNTER.idFromName('counter');
		const stub = env.COUNTER.get(id);
		const counterValue = await stub.getCounterValue();
		return c.json({ value: counterValue });
	})
	.post('/increment', async c => {
		const env = c.env;
		const id = env.COUNTER.idFromName('counter');
		const stub = env.COUNTER.get(id);
		const counterValue = await stub.increment();
		return c.json({ value: counterValue });
	})
	.post('/decrement', async c => {
		const env = c.env;
		const id = env.COUNTER.idFromName('counter');
		const stub = env.COUNTER.get(id);
		const counterValue = await stub.decrement();
		return c.json({ value: counterValue });
	});

export default app;
