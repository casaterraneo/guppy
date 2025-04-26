import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject {
	// In-memory state
	value = 0;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// `blockConcurrencyWhile()` ensures no requests are delivered until initialization completes.
		ctx.blockConcurrencyWhile(async () => {
			// After initialization, future reads do not need to access storage.
			this.value = (await ctx.storage.get('value')) || 0;
		});
	}

	async getCounterValue() {
		return this.value;
	}

	async increment(amount = 1): Promise<number> {
		this.value += amount;
		await this.ctx.storage.put('value', this.value);
		return this.value;
	}

	async decrement(amount = 1): Promise<number> {
		this.value -= amount;
		await this.ctx.storage.put('value', this.value);
		return this.value;
	}
}
