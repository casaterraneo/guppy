import { Hono } from 'hono';
import { BufferMemory } from 'langchain/memory';
import { CloudflareD1MessageHistory } from '@langchain/cloudflare';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

//https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-cloudflare/src/message_histories.ts
//https://js.langchain.com/docs/integrations/memory/cloudflare_d1/

// Define your tool
const fakeBrowserTool = tool(
	_ => {
		return 'The search result is xyz...';
	},
	{
		name: 'fake_browser_tool',
		description: 'Useful for when you need to find something on the web or summarize a webpage.',
		schema: z.object({
			url: z.string().describe('The URL of the webpage to search.'),
			query: z.string().optional().describe('An optional search query to use.'),
		}),
	}
);

//https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-google-genai/src/tests/chat_models.int.test.ts
class FakeBrowserTool extends StructuredTool {
	schema = z.object({
	  url: z.string(),
	  query: z.string().optional(),
	});

	name = "fake_browser_tool";

	description = "useful for when you need to find something on the web or summarize a webpage.";

	async _call(_: z.infer<this["schema"]>): Promise<string> {
	  return "fake_browser_tool";
	}
  }

  const GetWeather = {
	name: "GetWeather",
	description: "Get the current weather in a given location",
	schema: z.object({
	  location: z.string().describe("The city and state, e.g. San Francisco, CA")
	}),
  }

  const GetPopulation = {
	name: "GetPopulation",
	description: "Get the current population in a given location",
	schema: z.object({
	  location: z.string().describe("The city and state, e.g. San Francisco, CA")
	}),
  }

const app = new Hono()
	.post('barista-bot', async c => {
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
			//({ drink, modifiers }) => {
				//return `Adds ${drink} with modifiers: ${modifiers || "no modifiers"}`;
			//	return `Adds ${drink}`;
			//},
			_ => {
				return 'Adds milk';
			},
			{
				name: 'add_to_order',
				description: "Adds the specified drink to the customer's order, including any modifiers.",
				schema: z.object({
					drink: z.string().describe('The name of the drink to add to the order.'),
					modifiers: z.string().optional().describe('An optional description of the modifiers.'),
				}),
			}
		);

		const confirmOrderTool = tool(
			({ drink }) => {
				return 'Asks the customer to confirm their order.';
			},
			{
				name: 'confirm_order',
				description: 'Asks the customer if the order is correct.',
				schema: z.object({
					drink: z.string().optional().describe('The name of the drink to add to the order.'),
				}),
			}
		);

		const model = new ChatGoogleGenerativeAI({
			model: 'gemini-1.5-flash-latest',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		}).bindTools([fakeBrowserTool], {
			tool_choice: "any",
		});

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
	})
	.post('fake-browser-tool', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const input = messages[0];


		//https://js.langchain.com/docs/how_to/tool_choice/
		//model: "gemini-pro",
		const modelWithTools = new ChatGoogleGenerativeAI({
			model: "gemini-1.5-flash",
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN
		}).bindTools([fakeBrowserTool], {
			tool_choice: "any",
		});

		// const modelWithTools = model.bind({
		// 	tools: [new FakeBrowserTool()],
		//   });
		const res = await modelWithTools.invoke([
			[
				'human',
				input,
			],
		]);

		return c.json(res);
	})
	.post('clear-barista-bot', async c => {

		const db = c.get('db');

		//Il problema è che in SQLite (e nella maggior parte dei database SQL) non puoi usare un ? (placeholder)
		// per sostituire un nome di tabella o di colonna nei prepared statements.
		// I placeholder funzionano solo per i valori, non per i nomi delle tabelle o delle colonne.
		//Error: D1_ERROR: near "?": syntax error at offset 12: SQLITE_ERROR
		// const chatHistory = new CloudflareD1MessageHistory({
		// 	sessionId: 'barista-bot-session-id',
		// 	database: db,
		// });

		// const res = await chatHistory.clear();

		const query = `DELETE FROM langchain_chat_histories WHERE session_id = ? `;
		await db
		  .prepare(query)
		  .bind('barista-bot-session-id')
		  .all();

		return;
	});

export default app;
