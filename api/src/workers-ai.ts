import { Hono } from 'hono';
import { runWithTools } from "@cloudflare/ai-utils";

const app = new Hono()
	.post('/llm', async c => {
		const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } =
			await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const answer = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
			text: messages[0],
		});

		return c.json(answer);
	})
	.post('/vector-upsert', async c => {
		const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } =
			await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const modelResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
			text: messages,
		});

		let vectors: VectorizeVector[] = [];
		let id = 1;
		modelResp.data.forEach(vector => {
			vectors.push({ id: `${id}`, values: vector });
			id++;
		});

		let inserted = await c.env.VECTORIZE.upsert(vectors);

		return c.json(inserted);
	})
	.post('/vector-query', async c => {
		const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } =
			await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const modelResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
			text: messages[0],
		});

		const vector = modelResp.data[0];
		const result = await c.env.VECTORIZE.query(vector, { topK: 1 });

		return c.json(result.matches);
	})
	.post('/func-cal', async c => {
		// Define function
		const sum = (args: { a: number; b: number }): Promise<string> => {
			const { a, b } = args;
			return Promise.resolve((a + b).toString());
		};
		// Run AI inference with function calling
		const response = await runWithTools(
			c.env.AI,
			// Model with function calling support
			"@hf/nousresearch/hermes-2-pro-mistral-7b",
			{
			// Messages
			messages: [
				{
				role: "user",
				content: "What the result of 123123123 + 10343030?",
				},
			],
			// Definition of available tools the AI model can leverage
			tools: [
				{
				name: "sum",
				description: "Sum up two numbers and returns the result",
				parameters: {
					type: "object",
					properties: {
					a: { type: "number", description: "the first number" },
					b: { type: "number", description: "the second number" },
					},
					required: ["a", "b"],
				},
				// reference to previously defined function
				function: sum,
				},
			],
			},
		);

		return c.json(response);
	});

export default app;
