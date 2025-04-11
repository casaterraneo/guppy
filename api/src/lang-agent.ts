import { Hono } from 'hono';

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from '@langchain/core/tools';

import { z } from 'zod';

import {
	type BaseMessage,
	type BaseMessageLike,
	ToolMessage,
	AIMessage,
	isAIMessage,
} from '@langchain/core/messages';
import {
	addMessages,
	entrypoint,
	task,
	getPreviousState,
	interrupt,
	Command,
	MemorySaver,
} from '@langchain/langgraph';
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

		const fakeBrowserTool = tool(
			_ => {
				return 'The search result is xyz...';
			},
			{
				name: 'browser_tool',
				description:
					'Useful for when you need to find something on the web or summarize a webpage.',
				schema: z.object({
					url: z.string().describe('The URL of the webpage to search.'),
					query: z.string().optional().describe('An optional search query to use.'),
				}),
			}
		);

		const tools = [getWeather, fakeBrowserTool];

		const toolsByName = Object.fromEntries(tools.map(tool => [tool.name, tool]));

		const callModel = task('callModel', async (messages: BaseMessageLike[]) => {
			const systemMessage = {
				role: 'system',
				content:
					'You are a helpful assistant that translates English to Italian. Translate the user sentence.',
			};

			const response = await model.bindTools(tools).invoke([systemMessage, ...messages]);
			return response;
		});

		const callTool = task('callTool', async (toolCall: ToolCall): Promise<AIMessage> => {
			const tool = toolsByName[toolCall.name];
			const observation = await tool.invoke(toolCall.args);
			return new ToolMessage({ content: observation, tool_call_id: toolCall.id });
			// Can also pass toolCall directly into the tool to return a ToolMessage
			//return tool.invoke(toolCall);
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

		const db = c.get('db');
		const checkpointer = new D1Checkpointer(db);

		const agentWithMemory = entrypoint(
			{
				name: 'agentWithMemory',
				checkpointer,
			},
			async (messages: BaseMessageLike[]) => {
				const previous = getPreviousState<BaseMessage>() ?? [];
				let currentMessages = addMessages(previous, messages);
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
				// Append final response for storage
				currentMessages = addMessages(currentMessages, llmResponse);
				return entrypoint.final({
					value: llmResponse,
					save: currentMessages,
				});
			}
		);

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

		const config = { configurable: { thread_id: '2' } };

		const stream = await agentWithMemory.stream(userMessage, config);
		//const stream = await agent.stream([userMessage]);

		let content = '';
		for await (const step of stream) {
			for (const [taskName, update] of Object.entries(step)) {
				const message = update as BaseMessage;
				// Only print task updates
				if (taskName === 'agent' || taskName === 'agentWithMemory') continue;
				console.log(`\n${taskName}:`);
				prettyPrintMessage(message);
				content = message;
			}
		}

		return c.json(content);
	})
	.post('run-baristabot', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		let order: { drink: string; modifiers: string[] }[] = [];
		let placedOrder: { drink: string; modifiers: string[] }[] = [];

		const input = messages[0];
		const thread_id = '4';

		const model = new ChatGoogleGenerativeAI({
			model: 'gemini-2.0-flash',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		});

		const getMenuTool = tool(
			_ => {
				return `
				MENU:
				Coffee Drinks:
				Espresso
				Americano
				Cold Brew

				Coffee Drinks with Milk:
				Latte
				Cappuccino
				Cortado
				Macchiato
				Mocha
				Flat White

				Tea Drinks:
				English Breakfast Tea
				Green Tea
				Earl Grey

				Tea Drinks with Milk:
				Chai Latte
				Matcha Latte
				London Fog

				Other Drinks:
				Steamer
				Hot Chocolate

				Modifiers:
				Milk options: Whole, 2%, Oat, Almond, 2% Lactose Free; Default option: whole
				Espresso shots: Single, Double, Triple, Quadruple; default: Double
				Caffeine: Decaf, Regular; default: Regular
				Hot-Iced: Hot, Iced; Default: Hot
				Sweeteners (option to add one or more): vanilla sweetener, hazelnut sweetener, caramel sauce, chocolate sauce, sugar free vanilla sweetener
				Special requests: any reasonable modification that does not involve items not on the menu, for example: 'extra hot', 'one pump', 'half caff', 'extra foam', etc.

				"dirty" means add a shot of espresso to a drink that doesn't usually have it, like "Dirty Chai Latte".
				"Regular milk" is the same as 'whole milk'.
				"Sweetened" means add some regular sugar, not a sweetener.

				Soy milk has run out of stock today, so soy is not available.`;
			},
			{
				name: 'get_menu',
				description: 'Provide the latest up-to-date menu.',
			}
		);

		const addToOrderTool = tool(
			async ({ drink, modifiers }) => {
				try {
					order = await c.env.KV.get(thread_id, 'json');
					if (!order) {
						order = [];
					}
					order.push({ drink, modifiers: modifiers || [] });
					await c.env.KV.put(thread_id, JSON.stringify(order));
				} catch (err) {
					console.error(`KV returned error: ${err}`);
					return `Errore nell'aggiunta di ${drink} all'ordine.`;
				}
				return `Added ${drink} to the order.`;
			},
			{
				name: 'add_to_order',
				description: "Adds a specified drink to the customer's order, including any modifiers.",
				schema: z.object({
					drink: z.string().describe('The name of the drink.'),
					modifiers: z.array(z.string()).optional().describe('Optional list of modifiers.'),
				}),
			}
		);

		const confirmOrderTool = tool(
			async () => {
				let summary = 'Your order:\n';
				order = await c.env.KV.get(thread_id, 'json');
				if (!order || order.length === 0) {
					summary += '  (no items)\n';
				} else {
					for (const item of order) {
						summary += `  ${item.drink}\n`;
						if (item.modifiers && item.modifiers.length > 0) {
							summary += `   - ${item.modifiers.join(', ')}\n`;
						}
					}
				}
				//summary += '\nIs this correct?';
				return summary;
			},
			{
				name: 'confirm_order',
				description: 'Generates an order summary and asks for confirmation.',
			}
		);

		const getOrderTool = tool(
			async () => {
				try {
					const orderString = await c.env.KV.get(thread_id);
					if (orderString) {
						return orderString; // Return the JSON string directly
					} else {
						return '[]'; // Return an empty JSON array string if no order is found
					}
				} catch (error) {
					console.error('Error retrieving order from KV:', error);
					return 'Error retrieving order.';
				}
			},
			{
				name: 'get_order',
				description: "Returns the customer's current order.",
			}
		);

		const clearOrderTool = tool(
			async () => {
				await c.env.KV.delete(thread_id);
				order = [];
				return 'Order cleared.';
			},
			{
				name: 'clear_order',
				description: "Clears all items from the customer's order.",
			}
		);

		const placeOrderTool = tool(
			async () => {
				order = await c.env.KV.get(thread_id, 'json');
				if (!order || order.length === 0) {
					return 'No items in the order to place.';
				}
				await c.env.KV.put(`${thread_id}_placed`, JSON.stringify(order));
				await c.env.KV.delete(thread_id);
				const estimatedTime = Math.floor(Math.random() * 10) + 1;
				return `Order placed! Estimated time: ${estimatedTime} minutes.`;
			},
			{
				name: 'place_order',
				description:
					'Submits the order, saves it as placed, clears the current order, and returns an estimated time for completion.',
			}
		);

		const tools = [
			getMenuTool,
			addToOrderTool,
			confirmOrderTool,
			getOrderTool,
			clearOrderTool,
			placeOrderTool,
		];

		const toolsByName = Object.fromEntries(tools.map(tool => [tool.name, tool]));

		const callModel = task('callModel', async (messages: BaseMessageLike[]) => {
			const systemMessage = {
				role: 'system',
				content: `You are a BaristaBot, an interactive cafe ordering system. A human will talk to you about the
available products you have and you will answer any questions about menu items (and only about
menu items - no off-topic discussion, but you can chat about the products and their history).

Upon successful completion of the get_menu function and receipt of the menu data,
your immediate next action is to present this menu to the user within the chat interface.
Ensure the complete menu is displayed before proceeding with any further actions.

The customer will place an order for 1 or more items from the menu, which you will structure
and send to the ordering system after confirming the order with the human.

Add items to the customer's order with add_to_order, and reset the order with clear_order.
To see the contents of the order so far, call get_order (this is shown to you, not the user).

Always confirm_order with the user (double-check) before calling place_order.
Calling confirm_order will display immediate the order items to the user and returns their response to seeing the list.
Ensure the complete order items are displayed before proceeding with any further actions.
Their response may contain modifications.

Always verify and respond with drink and modifier names from the get_menu function before adding them to the order.
If you are unsure a drink or modifier matches those on the MENU (from the get_menu function), ask a question to clarify or redirect.
You only have the modifiers listed on the menu (from the get_menu function).

Once the customer has finished ordering items, Call confirm_order to ensure it is correct then make
any necessary updates and then call place_order. Once place_order has returned, thank the user and
say goodbye!

If any of the tools are unavailable, you can break the fourth wall and tell the user that
they have not implemented them yet and should keep reading to do so.
`,
			};

			const response = await model.bindTools(tools).invoke([systemMessage, ...messages]);
			return response;
		});

		const callTool = task('callTool', async (toolCall: ToolCall): Promise<AIMessage> => {
			const tool = toolsByName[toolCall.name];
			const observation = await tool.invoke(toolCall.args);
			return new ToolMessage({ content: observation, tool_call_id: toolCall.id });
		});

		const db = c.get('db');
		const checkpointer = new D1Checkpointer(db);

		const agentWithMemory = entrypoint(
			{
				name: 'agentWithMemory',
				checkpointer,
			},
			async (messages: BaseMessageLike[]) => {
				const previous = getPreviousState<BaseMessage>() ?? [];
				let currentMessages = addMessages(previous, messages);
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
				// Append final response for storage
				currentMessages = addMessages(currentMessages, llmResponse);
				return entrypoint.final({
					value: llmResponse,
					save: currentMessages,
				});
			}
		);

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

		const config = { configurable: { thread_id: thread_id } };

		const stream = await agentWithMemory.stream(userMessage, config);

		let content = '';
		for await (const step of stream) {
			for (const [taskName, update] of Object.entries(step)) {
				const message = update as BaseMessage;
				// Only print task updates
				if (taskName === 'agentWithMemory') continue;
				console.log(`\n${taskName}:`);
				prettyPrintMessage(message);
				content = message;
			}
		}

		return c.json(content);
	})
	.post('run-interrupt', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const step1 = task('step1', async (inputQuery: string) => {
			return `${inputQuery} bar`;
		});

		const humanFeedback = task('humanFeedback', async (inputQuery: string) => {
			const feedback = interrupt(`Please provide feedback: ${inputQuery}`);
			return `${inputQuery} ${feedback}`;
		});

		const step3 = task('step3', async (inputQuery: string) => {
			return `${inputQuery} qux`;
		});

		const db = c.get('db');
		const checkpointer = new D1Checkpointer(db);

		const graph = entrypoint(
			{
				name: 'graph',
				checkpointer,
			},
			async (inputQuery: string) => {
				const result1 = await step1(inputQuery);
				const result2 = await humanFeedback(result1);
				const result3 = await step3(result2);
				return result3;
			}
		);

		const input = messages[0];
		const thread_id = '5';

		const config = {
			configurable: {
				thread_id: thread_id,
			},
		};

		var stream;
		if (!input.includes('__interrupt__')) {
			stream = await graph.stream(input, config);
		} else {
			stream = await graph.stream(
				new Command({
					resume: input.replace('__interrupt__', '').trim(),
				}),
				config
			);
		}

		let content = '';
		// Continue execution
		for await (const event of stream) {
			if (event.__metadata__?.cached) {
				continue;
			}
			console.log(event);
			content = event;
		}

		return c.json(content);
	})
	.post('run-react-interrupt', async c => {
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
				// This is a placeholder for the actual implementation
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
					location: z.string().describe('Location to get the weather for'),
				}),
				description: 'Call to get the weather from a specific location.',
			}
		);

		const humanAssistance = tool(
			async ({ query }) => {
				const humanResponse = interrupt({ query });
				return humanResponse.data;
			},
			{
				name: 'humanAssistance',
				description: 'Request assistance from a human.',
				schema: z.object({
					query: z.string().describe('Human readable question for the human'),
				}),
			}
		);

		const tools = [getWeather, humanAssistance];

		const toolsByName = Object.fromEntries(tools.map(tool => [tool.name, tool]));

		const callModel = task('callModel', async (messages: BaseMessageLike[]) => {
			const response = await model.bindTools(tools).invoke(messages);
			return response;
		});

		const callTool = task('callTool', async (toolCall: ToolCall): Promise<AIMessage> => {
			const tool = toolsByName[toolCall.name];
			const observation = await tool.invoke(toolCall.args);
			return new ToolMessage({ content: observation, tool_call_id: toolCall.id });
			// Can also pass toolCall directly into the tool to return a ToolMessage
			// return tool.invoke(toolCall);
		});

		const agent = entrypoint(
			{
				name: 'agent',
				checkpointer: new MemorySaver(),
			},
			async (messages: BaseMessageLike[]) => {
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
			}
		);

		// const db = c.get('db');
		// const checkpointer = new D1Checkpointer(db);

		// const agentWithMemory = entrypoint(
		// 	{
		// 		name: 'agentWithMemory',
		// 		checkpointer,
		// 	},
		// 	async (messages: BaseMessageLike[]) => {
		// 		const previous = getPreviousState<BaseMessage>() ?? [];
		// 		let currentMessages = addMessages(previous, messages);
		// 		let llmResponse = await callModel(currentMessages);
		// 		while (true) {
		// 			if (!llmResponse.tool_calls?.length) {
		// 				break;
		// 			}
		// 			// Execute tools
		// 			const toolResults = await Promise.all(
		// 				llmResponse.tool_calls.map(toolCall => {
		// 					return callTool(toolCall);
		// 				})
		// 			);
		// 			// Append to message list
		// 			currentMessages = addMessages(currentMessages, [llmResponse, ...toolResults]);
		// 			// Call model again
		// 			llmResponse = await callModel(currentMessages);
		// 		}
		// 		// Append final response for storage
		// 		currentMessages = addMessages(currentMessages, llmResponse);
		// 		return entrypoint.final({
		// 			value: llmResponse,
		// 			save: currentMessages,
		// 		});
		// 	}
		// );

		const prettyPrintMessage = (message: BaseMessage) => {
			console.log('='.repeat(30), `${message.getType()} message`, '='.repeat(30));
			console.log(message.content);
			if (isAIMessage(message) && message.tool_calls?.length) {
				console.log(JSON.stringify(message.tool_calls, null, 2));
			}
		};

		const prettyPrintStep = (step: Record<string, any>) => {
			if (step.__metadata__?.cached) {
				return;
			}
			for (const [taskName, update] of Object.entries(step)) {
				const message = update as BaseMessage;
				// Only print task updates
				if (taskName === 'agent') continue;
				console.log(`\n${taskName}:`);
				if (taskName === '__interrupt__') {
					console.log(update);
				} else {
					prettyPrintMessage(message);
				}
			}
		};

		const userMessage = {
			role: 'user',
			content: [
				'Can you reach out for human assistance: what should I feed my cat?',
				'Separately, can you check the weather in San Francisco?',
			].join(' '),
		};
		console.log(userMessage);

		const config = {
			configurable: {
				thread_id: '6',
			},
		};

		const agentStream = await agent.stream([userMessage], config);

		let lastStep;

		for await (const step of agentStream) {
			prettyPrintStep(step);
			lastStep = step;
		}
		console.log(JSON.stringify(lastStep));
		const humanResponse = 'You should feed your cat a fish.';
		const humanCommand = new Command({
			resume: { data: humanResponse },
		});

		const resumeStream2 = await agent.stream(humanCommand, config);

		for await (const step of resumeStream2) {
			prettyPrintStep(step);
		}

		return c.json(step);
	});
export default app;
