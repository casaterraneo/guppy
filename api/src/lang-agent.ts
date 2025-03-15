import { Hono } from 'hono';

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from "@langchain/core/tools";

import { z } from "zod";

const search = tool(async ({ query }) => {
	if (query.toLowerCase().includes("sf") || query.toLowerCase().includes("san francisco")) {
	  return "It's 60 degrees and foggy."
	}
	return "It's 90 degrees and sunny."
  }, {
	name: "search",
	description: "Call to surf the web.",
	schema: z.object({
	  query: z.string().describe("The query to use in your search."),
	}),
  });

const app = new Hono()
	.post('run', async c => {
		const { messages } = await c.req.json();
		if (!messages)
			return c.json({ error: 'Message is required' }, 400);

		const input = messages[0];

		//https://ai.google.dev/gemini-api/docs/models/gemini
		//gemini-pro
		//model: 'gemini-1.5-flash-latest',
		const model = new ChatGoogleGenerativeAI({
			model: 'gemini-2.0-flash',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		});

		const agent = createReactAgent({
			llm: model,
			tools: [search],
		  });

		  const result = await agent.invoke(
			{
			  messages: [{
				role: "user",
				content: "what is the weather in sf"
			  }]
			}
		  );

		  console.log(result);

		  return c.json(result);
	});

export default app;
