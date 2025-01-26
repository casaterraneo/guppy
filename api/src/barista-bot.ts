import { Hono } from 'hono';
import { BufferMemory } from 'langchain/memory';
import { CloudflareD1MessageHistory } from '@langchain/cloudflare';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

//https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-cloudflare/src/message_histories.ts
//https://js.langchain.com/docs/integrations/memory/cloudflare_d1/

const app = new Hono().post('barista-bot', async c => {
	const { messages } = await c.req.json();
	if (!messages) return c.json({ error: 'Message is required' }, 400);

	const input = messages[0];

	const db = c.get('db');
	const memory = new BufferMemory({
		returnMessages: true,
		chatHistory: new CloudflareD1MessageHistory({
			sessionId: 'barista-bot-session-id',
			database: db,
		}),
	});

	const prompt = ChatPromptTemplate.fromMessages([
		[
			'system',
			`You are a BaristaBot, an interactive cafe ordering system. A human will talk to you about the
available products you have and you will answer any questions about menu items (and only about
menu items - no off-topic discussion, but you can chat about the products and their history).
The customer will place an order for 1 or more items from the menu, which you will structure
and send to the ordering system after confirming the order with the human.


Add items to the customer's order with add_to_order, and reset the order with clear_order.
To see the contents of the order so far, call get_order (this is shown to you, not the user)
Always confirm_order with the user (double-check) before calling place_order. Calling confirm_order will
display the order items to the user and returns their response to seeing the list. Their response may contain modifications.
Always verify and respond with drink and modifier names from the MENU before adding them to the order.
If you are unsure a drink or modifier matches those on the MENU, ask a question to clarify or redirect.
You only have the modifiers listed on the menu.
Once the customer has finished ordering items, Call confirm_order to ensure it is correct then make
any necessary updates and then call place_order. Once place_order has returned, thank the user and
say goodbye!`,
		],
		new MessagesPlaceholder('history'),
		['user', '{input}'],
	]);

	// Define your tool
	const addToOrderTool = tool(
		({ drink, modifiers }) => {
			return `Adds ${drink} with modifiers: ${modifiers || "no modifiers"}`;
		},
		{
			name: 'add_to_order',
			description: "Adds the specified drink to the customer's order, including any modifiers.",
			schema: z.object({
				drink: z.string().describe('The name of the drink to add to the order.'),
				modifiers: z.string().optional().describe("An optional description of the modifiers."),
			}),
		}
	);

	const confirmOrderTool = tool(
		({drink}) => {
			return 'Asks the customer to confirm their order.';
		},
		{
			name: 'confirm_order',
			description: 'Asks the customer if the order is correct.',
			schema: z.object({
				drink: z.string().optional().describe("The name of the drink to add to the order.")
			}),
		}
	);

	const model = new ChatGoogleGenerativeAI({
		model: 'gemini-1.5-flash-latest',
		apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
		temperature: 0,
	}).bindTools([addToOrderTool, confirmOrderTool]);

	const chain = RunnableSequence.from([
		{
			input: initialInput => initialInput.input,
			memory: () => memory.loadMemoryVariables({}),
		},
		{
			input: previousOutput => previousOutput.input,
			history: previousOutput => previousOutput.memory.history,
		},
		prompt,
		model,
		new StringOutputParser(),
	]);

	const chainInput = { input };

	const res = await chain.invoke(chainInput);
	await memory.saveContext(chainInput, {
		output: res,
	});

	return c.json(res);
});

export default app;
