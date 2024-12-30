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
		const updateKvValue = async ({
			key,
			value,
		}: {
			key: string;
			value: string;
		}) => {
			const response = await c.env.KV.put(key, value);
			return `Successfully updated key-value pair in database: ${response}`;
		};

		// Run AI inference with function calling
		const response = await runWithTools(
			c.env.AI,
			"@hf/nousresearch/hermes-2-pro-mistral-7b",
			{
			messages: [
				{ role: "system", content: "Put user given values in KV" },
				{ role: "user", content: "Set the value of banana to yellow." },
			],
			tools: [
				{
				name: "KV update",
				description: "Update a key-value pair in the database",
				parameters: {
					type: "object",
					properties: {
					key: {
						type: "string",
						description: "The key to update",
					},
					value: {
						type: "string",
						description: "The value to update",
					},
					},
					required: ["key", "value"],
				},
				function: updateKvValue,
				},
			],
			},
		);

		return c.json(response);
	});

export default app;
