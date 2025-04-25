import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/cloudflare-workers';

const app = new Hono().get(
	'/',
	upgradeWebSocket(c => {
		return {
			onMessage(event, ws) {
				console.log(`Message from client: ${event.data}`);
				ws.send(event.data);
			},
			onClose: () => {
				console.log('Connection closed');
			},
		};
	})
);

export default app;
