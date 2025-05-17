import { DurableObject } from 'cloudflare:workers';

// 1. Make sure the class name corresponds exactly with the one
// added in wrangler.toml earlier
export class TrisReceiver extends DurableObject {
	board: string;

	constructor(ctx: DurableObjectState, env: CloudflareBindings) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			// After initialization, future reads do not need to access storage.
			this.board = (await ctx.storage.get('board')) || '';
		});
	}

	// 2. This fetch method serves as a communication layer between the Worker
	// and the Durable Object
	async fetch(request: Request) {
		console.log(`Message from client: ${request}`);

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);

		if (this.board) {
			console.log(`Server send board to client: ${this.board}`);
			server.send(this.board);
		}

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws, message) {
		await this.ctx.storage.put('board', message);
		this.board = message;
		// Broadcast the message to all connected clients
		for (const connection of this.ctx.getWebSockets()) {
			connection.send(message);
		}
	}

	async webSocketClose(ws, code, reason, wasClean) {
		// If the client closes the connection, the runtime will invoke the webSocketClose() handler.
		ws.close(code, 'Durable Object is closing WebSocket');
	}

	// Clears Durable Object storage
	async clearDo(): Promise<void> {
		// If you've configured a Durable Object alarm
		//await this.ctx.storage.deleteAlarm();

		// This will delete all the storage associated with this Durable Object instance
		// This will also delete the Durable Object instance itself
		await this.ctx.storage.deleteAll();
	}
}
