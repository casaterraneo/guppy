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
			onClose: (event, ws) => {
				console.log('Connection closed');
				ws.close();
			},
		};
	})
);

export default app;
