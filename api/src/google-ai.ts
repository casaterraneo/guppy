import { Hono } from 'hono';
import { GoogleGenerativeAI } from "@google/generative-ai";

enum Sentiment {
    POSITIVE = "positive",
    NEUTRAL = "neutral",
    NEGATIVE = "negative"
}

function getResponseSchema(responseSchema: string) {
    switch (responseSchema) {
        case 'Sentiment':
            return Object.values(Sentiment);
        default:
            return null;
    }
}


const app = new Hono()
.post('/', async (c) => {
	const { message, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } = await c.req.json();
	if (!message) return c.json({ error: 'Message is required' }, 400);

	const customHeaders = {
		'cf-aig-authorization': `Bearer ${c.env.CF_AIG_TOKEN}`
	};

	const generationConfig = {
		temperature,
		topK,
		topP,
		maxOutputTokens,
		responseMimeType,
		responseSchema : Sentiment
	};

	const genAI = new GoogleGenerativeAI(c.env.GOOGLE_AI_STUDIO_TOKEN);
	const model = genAI.getGenerativeModel({
		model: "gemini-1.5-flash",
		baseUrl: 'https://gateway.ai.cloudflare.com/v1/fe04af051f86d0ff6f22622b45242473/guppy-ai-gateway/google-ai-studio',
		requestOptions: {
			customHeaders: customHeaders // Include custom headers here
		}
	});

	const chat = model.startChat({
		history: [
		  {
			role: "user",
			parts: [{ text: "May name is Pippo" }],
		  }
		],
		generationConfig: generationConfig,
	  });

	let result = await chat.sendMessage([message]);
	//const result = await model.generateContent([message]);

	return c.json(result.response.text());
});

export default app;
