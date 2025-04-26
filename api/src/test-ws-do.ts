import { Hono } from 'hono';

const app = new Hono().get("/", async (c) => {
	const id = c.env.WEBHOOK_RECEIVER.idFromName("default");
	const stub = c.env.WEBHOOK_RECEIVER.get(id);
	return stub.fetch(c.req.raw);
  });

export default app;
