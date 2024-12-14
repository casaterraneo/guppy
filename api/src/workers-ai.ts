import { Hono } from 'hono';

const app = new Hono()
.post('/', async (c) => {

	const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } = await c.req.json();
	if (!messages) return c.json({ error: 'Message is required' }, 400);

	const answer = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
		 prompt: "What is the origin of the phrase 'Hello, World'"
	});
	return c.json(answer);
});

export default app;