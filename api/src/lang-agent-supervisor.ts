import { Hono } from 'hono';
import { z } from 'zod';

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatCohere } from '@langchain/cohere';

const app = new Hono()
	.post('run-agent-supervisor', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const input = messages[0];

		return c.json(input);
	});
	export default app;
