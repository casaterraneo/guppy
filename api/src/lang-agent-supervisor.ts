import { Hono } from 'hono';

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatCohere } from '@langchain/cohere';

import { createSupervisor } from '@langchain/langgraph-supervisor';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const add = tool(async args => args.a + args.b, {
	name: 'add',
	description: 'Add two numbers.',
	schema: z.object({
		a: z.number(),
		b: z.number(),
	}),
});

const multiply = tool(async args => args.a * args.b, {
	name: 'multiply',
	description: 'Multiply two numbers.',
	schema: z.object({
		a: z.number(),
		b: z.number(),
	}),
});

const webSearch = tool(
	async args => {
		return (
			'Here are the headcounts for each of the FAANG companies in 2024:\n' +
			'1. **Facebook (Meta)**: 67,317 employees.\n' +
			'2. **Apple**: 164,000 employees.\n' +
			'3. **Amazon**: 1,551,000 employees.\n' +
			'4. **Netflix**: 14,000 employees.\n' +
			'5. **Google (Alphabet)**: 181,269 employees.'
		);
	},
	{
		name: 'web_search',
		description: 'Search the web for information.',
		schema: z.object({
			query: z.string(),
		}),
	}
);

const app = new Hono().post('run-agent-supervisor', async c => {
	const { messages } = await c.req.json();
	if (!messages) return c.json({ error: 'Message is required' }, 400);

	//TEST command-r7b-12-2024, command-a-03-2025, command-r-plus (non va nulla)
	//what's the combined headcount of the FAANG companies in 2024?
		//Unfortunately, I am unable to answer your request.
	//what's the headcount of the Netflix company in 2024?
		//The headcount of Netflix in 2024 is 14,000 employees.
		//Apologies, I have no information on the headcount of Netflix in 2024.
	//2+2
		//The answer is 4.
	const input = messages[0];

	const model = new ChatGoogleGenerativeAI({
		model: 'gemini-2.0-flash',
		apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
		temperature: 0,
	});

	// const model = new ChatCohere({
	// 	model: 'command-a-03-2025',
	// 	apiKey: c.env.COHERE_API_KEY,
	// 	temperature: 0,
	// });

	console.log('model', model);

	const mathAgent = createReactAgent({
		llm: model,
		tools: [add, multiply],
		name: 'math_expert',
		prompt: 'You are a math expert. Always use one tool at a time.',
	});
	console.log('mathAgent', mathAgent);

	const researchAgent = createReactAgent({
		llm: model,
		tools: [webSearch],
		name: 'research_expert',
		prompt: 'You are a world class researcher with access to web search. Do not do any math.',
	});
	console.log('researchAgent', researchAgent);

	const workflow = createSupervisor({
		agents: [researchAgent, mathAgent],
		llm: model,
		//outputMode: "last_message",
		//outputMode: "full_history"
		prompt:
			'You are a team supervisor managing a research expert and a math expert. ' +
			'For current events, use research_agent. ' +
			'For math problems, use math_agent.',
	});

	console.log('workflow', workflow);

	// Compile and run
	const app = workflow.compile();

	console.log('app', app);

	const result = await app.invoke({
		messages: [
			{
				role: 'user',
				content: input,
			},
		],
	});

	return c.json(result);
});
export default app;
