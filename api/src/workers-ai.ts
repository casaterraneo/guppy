import { Hono } from 'hono';

const app = new Hono()
.post('/llm', async (c) => {

	const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } = await c.req.json();
	if (!messages) return c.json({ error: 'Message is required' }, 400);

	const answer = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
		text: messages,
	});

	return c.json(answer);
})
.post('/vector', async (c) => {

	const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } = await c.req.json();
	if (!messages) return c.json({ error: 'Message is required' }, 400);

	const modelResp = await c.env.AI.run('@cf/baai/bge-small-en-v1.5', {
		text: messages,
	});

	let vectors: VectorizeVector[] = [];
	let id = 1;
	modelResp.data.forEach((vector) => {
	  vectors.push({ id: `${id}`, values: vector });
	  id++;
	});

	let inserted = await c.env.VECTORIZE.upsert(vectors);

	return c.json(inserted);
});

export default app;
