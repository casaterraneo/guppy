import { DurableObject } from "cloudflare:workers";

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
    return new Response("Hello world from a Durable Object");
  }
}
