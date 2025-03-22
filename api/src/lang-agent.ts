import { Hono } from 'hono';

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from '@langchain/core/tools';
import { MemorySaver } from '@langchain/langgraph';

import { z } from 'zod';

import type { BaseMessage, BaseMessageLike } from '@langchain/core/messages';
import { addMessages, entrypoint, task, getPreviousState } from '@langchain/langgraph';

import { D1Checkpointer } from './D1Checkpointer';

const search = tool(
	async ({ query }) => {
		if (query.toLowerCase().includes('sf') || query.toLowerCase().includes('san francisco')) {
			return "It's 60 degrees and foggy.";
		}
		return "It's 90 degrees and sunny.";
	},
	{
		name: 'search',
		description: 'Call to surf the web.',
		schema: z.object({
			query: z.string().describe('The query to use in your search.'),
		}),
	}
);

const app = new Hono()
	.post('run-agent', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const input = messages[0];

		//https://ai.google.dev/gemini-api/docs/models/gemini
		//gemini-pro
		//model: 'gemini-1.5-flash-latest',
		const model = new ChatGoogleGenerativeAI({
			model: 'gemini-2.0-flash',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		});

		const agentCheckpointer = new MemorySaver();

		const agent = createReactAgent({
			llm: model,
			tools: [search],
			checkpointSaver: agentCheckpointer,
		});

		const output1 = await agent.invoke(
			{ messages: [{ role: 'user', content: input }] },
			{ configurable: { thread_id: '42' } }
		);

		console.log(output1.messages);

		const output2 = await agent.invoke(
			{ messages: [{ role: 'user', content: 'what is the current weather in my country' }] },
			{ configurable: { thread_id: '42' } }
		);

		console.log(output2.messages);

		return c.json(output2.messages.map(msg => msg.content));
	})
	.post('run-functional', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const input = messages[0];

		//https://ai.google.dev/gemini-api/docs/models/gemini
		//gemini-pro
		//model: 'gemini-1.5-flash-latest',
		const model = new ChatGoogleGenerativeAI({
			model: 'gemini-2.0-flash',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		});

		const callModel = task('callModel', async (messages: BaseMessageLike[]) => {
			const response = model.invoke(messages);
			return response;
		});

		//const checkpointer = new MemorySaver();
		const db = c.get('db');
		const checkpointer = new D1Checkpointer(db);

		const workflow = entrypoint(
			{
				name: 'workflow',
				checkpointer,
			},
			async (inputs: BaseMessageLike[]) => {
				const previous = getPreviousState<BaseMessage>() ?? [];
				const messages = addMessages(previous, inputs);
				const response = await callModel(messages);
				return entrypoint.final({
					value: response,
					save: addMessages(messages, response),
				});
			}
		);

		const config = {
			configurable: { thread_id: '1' },
			streamMode: 'values' as const,
		};
		const inputMessage = { role: 'user', content: input };

		const stream = await workflow.stream([inputMessage], config);

		for await (const chunk of stream) {
			console.log('='.repeat(30), `${chunk.getType()} message`, '='.repeat(30));
			console.log(chunk.content);
		}

		const followupStream = await workflow.stream(
			[{ role: 'user', content: "what's my name?" }],
			config
		);

		let content = ''
		for await (const chunk of followupStream) {
			console.log('='.repeat(30), `${chunk.getType()} message`, '='.repeat(30));
			console.log(chunk.content);
			content = chunk.content;
		}

		const newStream = await workflow.stream([{ role: 'user', content: "what's my name?" }], {
			configurable: {
				thread_id: '2',
			},
			streamMode: 'values',
		});

		for await (const chunk of newStream) {
			console.log('='.repeat(30), `${chunk.getType()} message`, '='.repeat(30));
			console.log(chunk.content);
		}

		return c.json(content);
	});
export default app;
