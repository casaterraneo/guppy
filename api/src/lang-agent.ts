import { Hono } from 'hono';

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from '@langchain/core/tools';
import { MemorySaver } from '@langchain/langgraph';

import { z } from 'zod';

import type {
	BaseMessage,
	BaseMessageLike,
	ToolMessage,
	AIMessage,
	isAIMessage,
} from '@langchain/core/messages';
import { addMessages, entrypoint, task, getPreviousState } from '@langchain/langgraph';
import { type ToolCall } from '@langchain/core/messages/tool';

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

		let content = '';
		for await (const chunk of stream) {
			console.log('='.repeat(30), `${chunk.getType()} message`, '='.repeat(30));
			console.log(chunk.content);
			content = chunk.content;
		}

		return c.json(content);
	})
	.post('run-react', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const input = messages[0];

		const model = new ChatGoogleGenerativeAI({
			model: 'gemini-2.0-flash',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		});

		const getWeather = tool(
			async ({ location }) => {
				const lowercaseLocation = location.toLowerCase();
				if (lowercaseLocation.includes('sf') || lowercaseLocation.includes('san francisco')) {
					return "It's sunny!";
				} else if (lowercaseLocation.includes('boston')) {
					return "It's rainy!";
				} else {
					return `I am not sure what the weather is in ${location}`;
				}
			},
			{
				name: 'getWeather',
				schema: z.object({
					location: z.string().describe('location to get the weather for'),
				}),
				description: 'Call to get the weather from a specific location.',
			}
		);

		const tools = [getWeather];

		const toolsByName = Object.fromEntries(tools.map(tool => [tool.name, tool]));

		const callModel = task('callModel', async (messages: BaseMessageLike[]) => {
			const response = await model.bindTools(tools).invoke(messages);
			return response;
		});

		const callTool = task('callTool', async (toolCall: ToolCall): Promise<AIMessage> => {
			const tool = toolsByName[toolCall.name];
			//const observation = await tool.invoke(toolCall.args);
			//return new ToolMessage({ content: observation, tool_call_id: toolCall.id });
			// Can also pass toolCall directly into the tool to return a ToolMessage
			return tool.invoke(toolCall);
		});

		const agent = entrypoint('agent', async (messages: BaseMessageLike[]) => {
			let currentMessages = messages;
			let llmResponse = await callModel(currentMessages);
			while (true) {
				if (!llmResponse.tool_calls?.length) {
					break;
				}
				// Execute tools
				const toolResults = await Promise.all(
					llmResponse.tool_calls.map(toolCall => {
						return callTool(toolCall);
					})
				);
				// Append to message list
				currentMessages = addMessages(currentMessages, [llmResponse, ...toolResults]);
				// Call model again
				llmResponse = await callModel(currentMessages);
			}
			return llmResponse;
		});

		const prettyPrintMessage = (message: BaseMessage) => {
			console.log('='.repeat(30), `${message.getType()} message`, '='.repeat(30));
			console.log(message.content);
			if (isAIMessage(message) && message.tool_calls?.length) {
				console.log(JSON.stringify(message.tool_calls, null, 2));
			}
		};

		// Usage example
		const userMessage = { role: 'user', content: input };
		console.log(userMessage);

		const stream = await agent.stream([userMessage]);

		let content = '';
		for await (const step of stream) {
			for (const [taskName, update] of Object.entries(step)) {
				const message = update as BaseMessage;
				// Only print task updates
				if (taskName === 'agent') continue;
				console.log(`\n${taskName}:`);
				prettyPrintMessage(message);
				content = message;
			}
		}

		return c.json(content);
	});
export default app;
