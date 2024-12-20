import { Hono } from 'hono';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface PizzaOrder {
    size: string;
    ingredients: string[];
    type: string;
}

function getResponseSchema(responseSchema: string) {
    switch (responseSchema) {
        case 'Sentiment':
            return { type: "STRING", enum:["POSITIVE", "NEUTRAL", "NEGATIVE"] };
		case 'PizzaOrder':
			return {
				type: "OBJECT",
				properties: {
						size: { type: "STRING" },
						ingredients: { type: "ARRAY", items: { type: "STRING" } },
						type: { type: "STRING"}
					},
					required: ["size", "type", "ingredients"]
				};
		case 'PizzaOrderList':
			return {type: "ARRAY", items:
				{
				type: "OBJECT",
				properties: {
						size: { type: "STRING" },
						ingredients: { type: "ARRAY", items: { type: "STRING" } },
						type: { type: "STRING"}
					},
					required: ["size", "type", "ingredients"]
				}
			};
        default:
            return null;
    }
}


const app = new Hono()
.post('/', async (c) => {
	const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } = await c.req.json();
	if (!messages) return c.json({ error: 'Message is required' }, 400);

	const customHeaders = {
		'cf-aig-authorization': `Bearer ${c.env.CF_AIG_TOKEN}`
	};

	const generationConfig = {
		temperature,
		topK,
		topP,
		maxOutputTokens,
		responseMimeType,
		//responseSchema : JSON.stringify(Sentiment)
		//responseSchema : ['POSITIVE', 'NEUTRAL', 'NEGATIVE']
		//responseSchema : { POSITIVE: "positive", NEUTRAL: "neutral", NEGATIVE: "negative"}
		responseSchema : getResponseSchema(responseSchema),
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

	let result = await chat.sendMessage(messages);
	//const result = await model.generateContent([message]);

	return c.json(result.response.text());
});

export default app;
