import { DurableObject } from 'cloudflare:workers';

// 1. Make sure the class name corresponds exactly with the one
// added in wrangler.toml earlier
export class WebhookReceiver extends DurableObject {
	constructor(ctx: DurableObjectState, env: CloudflareBindings) {
		super(ctx, env);
	}
	// 2. This fetch method serves as a communication layer between the Worker
	// and the Durable Object
	async fetch(request: Request) {
		console.log(`Message from client: ${request}`);

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);

		//return new Response("Hello world from a Durable Object");
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws, message) {
		// Upon receiving a message from the client, reply with the same message,
		// but will prefix the message with "[Durable Object]: " and return the
		// total number of connections.
		// ws.send(
		// 	`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`
		// );

		// Broadcast the message to all connected clients
		for (const connection of this.ctx.getWebSockets()) {
			connection.send(message);
		}
	}

	async webSocketClose(ws, code, reason, wasClean) {
		// If the client closes the connection, the runtime will invoke the webSocketClose() handler.
		ws.close(code, 'Durable Object is closing WebSocket');
	}
}
