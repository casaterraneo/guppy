import { Hono } from 'hono';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = new Hono()
.post('/', async (c) => {
	const { message } = await c.req.json();
	if (!message) return c.json({ error: 'Message is required' }, 400);

	console.log(message);

	const genAI = new GoogleGenerativeAI(c.env.GOOGLE_AI_STUDIO_TOKEN);
	const model = genAI.getGenerativeModel(
		{
			model: "gemini-1.5-flash"
		},
		{
			baseUrl: 'https://gateway.ai.cloudflare.com/v1/fe04af051f86d0ff6f22622b45242473/guppy-ai-gateway/google-ai-studio',
		},
	);

	const result = await model.generateContent([message]);

	return c.json(result.response.text());
})

export default app;
