import { Hono } from 'hono';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
	START,
	END,
	MessagesAnnotation,
	StateGraph,
	MemorySaver,
	Annotation,
} from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import { ChatPromptTemplate } from '@langchain/core/prompts';

interface PizzaOrder {
	size: string;
	ingredients: string[];
	type: string;
}

function getResponseSchema(responseSchema: string) {
	switch (responseSchema) {
		case 'Sentiment':
			return { type: 'STRING', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] };
		case 'PizzaOrder':
			return {
				type: 'OBJECT',
				properties: {
					size: { type: 'STRING' },
					ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
					type: { type: 'STRING' },
				},
				required: ['size', 'type', 'ingredients'],
			};
		case 'PizzaOrderList':
			return {
				type: 'ARRAY',
				items: {
					type: 'OBJECT',
					properties: {
						size: { type: 'STRING' },
						ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
						type: { type: 'STRING' },
					},
					required: ['size', 'type', 'ingredients'],
				},
			};
		default:
			return null;
	}
}

const app = new Hono()
	.post('/llm', async c => {
		const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } =
			await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const customHeaders = {
			'cf-aig-authorization': `Bearer ${c.env.CF_AIG_TOKEN}`,
		};

		const generationConfig = {
			temperature,
			topK,
			topP,
			maxOutputTokens,
			responseMimeType,
			//responseSchema : JSON.stringify(Sentiment)
			//responseSchema : ['POSITIVE', 'NEUTRAL', 'NEGATIVE']
			//responseSchema : { POSITIVE: positive, NEUTRAL: neutral, NEGATIVE: negative}
			responseSchema: getResponseSchema(responseSchema),
		};

		const genAI = new GoogleGenerativeAI(c.env.GOOGLE_AI_STUDIO_TOKEN);
		const model = genAI.getGenerativeModel({
			model: 'gemini-1.5-flash',
			baseUrl:
				'https://gateway.ai.cloudflare.com/v1/fe04af051f86d0ff6f22622b45242473/guppy-ai-gateway/google-ai-studio',
			requestOptions: {
				customHeaders: customHeaders, // Include custom headers here
			},
		});

		const chat = model.startChat({
			history: [
				{
					role: 'user',
					parts: [{ text: 'May name is Pippo' }],
				},
			],
			generationConfig: generationConfig,
		});

		let result = await chat.sendMessage(messages);
		//const result = await model.generateContent([message]);

		return c.json(result.response.text());
	})
	.post('/func-cal', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		// Define function
		const listTables = async () => {
			console.log(' - DB CALL: list_tables');
			const db = c.get('db');
			const all = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table';`).all();
			return all.results.map(row => row.name);
		};

		const describeTable = async tableName => {
			console.log(' - DB CALL: describe_table');
			const db = c.get('db');
			const all = await db.prepare(`PRAGMA table_info(${tableName});`).all();
			//return all.results.map(col => [col.name, col.type]);
			return all.results.map(col => ({
				columnName: col.name,
				columnType: col.type,
				pk: col.pk,
			}));
		};

		const executeQuery = async sqlQuery => {
			console.log(' - DB CALL: execute_query');
			const db = c.get('db');
			const all = await db.prepare(sqlQuery).all();
			return all.results;
		};

		const customHeaders = {
			'cf-aig-authorization': `Bearer ${c.env.CF_AIG_TOKEN}`,
		};

		const genAI = new GoogleGenerativeAI(c.env.GOOGLE_AI_STUDIO_TOKEN);
		const model = genAI.getGenerativeModel({
			model: 'gemini-1.5-flash-latest',
			baseUrl:
				'https://gateway.ai.cloudflare.com/v1/fe04af051f86d0ff6f22622b45242473/guppy-ai-gateway/google-ai-studio',
			requestOptions: {
				customHeaders: customHeaders, // Include custom headers here
			},
			// Specify the function declaration.
			tools: [
				{
					function_declarations: [
						{
							name: 'listTables',
							description: 'Retrieve the names of all tables in the database.',
						},
						{
							name: 'describeTable',
							description: `Look up the table schema.
							 			Returns:
							 			List of columns, using this JSON schema:
										Column = {'columnName': string, 'columnType': string, 'pk': int}
										Return: Array<Column>.`,
							parameters: {
								type: 'object',
								properties: {
									tableName: {
										type: 'string',
										description: 'The name of the table to describe.',
									},
								},
								required: ['tableName'],
							},
						},
						{
							name: 'executeQuery',
							description: `Execute a SELECT statement, returning the results.`,
							parameters: {
								type: 'object',
								properties: {
									sqlQuery: {
										type: 'string',
										description: 'The sql to execute.',
									},
								},
								required: ['sqlQuery'],
							},
						},
					],
				},
			],
			systemInstruction: {
				role: 'model',
				parts: [
					{
						text: `You are a helpful chatbot that can interact with an SQL database for a computer
store. You will take the users questions and turn them into SQL queries using the tools
available. Once you have the information you need, you will answer the user's question using
the data returned. Use listTables to see what tables are present, describeTable to understand
the schema, and executeQuery to issue an SQL SELECT query.`,
					},
				],
			},
		});

		//https://ai.google.dev/gemini-api/docs/function-calling
		const toolConfig = {
			functionCallingConfig: {
				mode: 'ANY',
				allowedFunctionNames: ['listTables', 'describeTable', 'executeQuery'],
			},
		};

		const chat = model.startChat({
			toolConfig: toolConfig,
		});
		let result = await chat.sendMessage(messages);
		let functionCalls = result.response.functionCalls();

		console.log(functionCalls);
		let call = functionCalls[0];

		console.log(call);
		if (call.name === 'listTables') {
			const listTablesResponse = await listTables();
			console.log('Describe List Tables Response:', listTablesResponse);
			result = await chat.sendMessage(listTablesResponse);
			functionCalls = result.response.functionCalls();
			console.log(functionCalls);
			call = functionCalls[0];
		}
		console.log(call);
		if (call.name === 'describeTable') {
			const describeTableResponse = await describeTable(call.args.tableName);
			//result = await chat.sendMessage(describeTableResponse);
			console.log('Describe Table Response:', describeTableResponse);
			const result = await chat.sendMessage(JSON.stringify(describeTableResponse));
			functionCalls = result.response.functionCalls();
			console.log(functionCalls);
			call = functionCalls[0];
		}
		console.log(call);
		if (call.name === 'executeQuery') {
			console.log('Original Query:', call.args.sqlQuery);
			const unescapedQuery = call.args.sqlQuery.replace(/\\/g, '');
			console.log('After removing \\:', unescapedQuery);
			const finalQuery = unescapedQuery.replace(//g, ');
			console.log('Final Query:', finalQuery);
			const executeQueryResponse = await executeQuery(finalQuery);
			return c.json(executeQueryResponse);
		}

		return c.json(result.response.text());
	})
	.post('/lang-graph', async c => {
		const { messages } = await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const llm = new ChatGoogleGenerativeAI({
			model: 'gemini-1.5-flash-latest',
			apiKey: c.env.GOOGLE_AI_STUDIO_TOKEN,
			temperature: 0,
		});

		const promptTemplate = ChatPromptTemplate.fromMessages([
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
    say goodbye!


	Answer all questions to the best of your ability in {language}.`,
			],
			['placeholder', '{messages}'],
		]);

		// Define the State
		const GraphAnnotation = Annotation.Root({
			...MessagesAnnotation.spec,
			language: Annotation<string>(),
		});

		// Define the function that calls the model
		const callModel = async (state: typeof GraphAnnotation.State) => {
			//const response = await llm.invoke(state.messages);
			const prompt = await promptTemplate.invoke(state);
			const response = await llm.invoke(prompt);
			return { messages: [response] };
		};

		// Define a new graph
		const workflow = new StateGraph(GraphAnnotation)
			// Define the node and edge
			.addNode('model', callModel)
			.addEdge(START, 'model');
			//.addEdge('model', END);

		const app = workflow.compile({ checkpointer: new MemorySaver() });

		const config = { configurable: { thread_id: uuidv4() } };
		const input = {
			messages: [
			  {
				role: "user",
				content: "Hello, what can you do?",
			  },
			],
			language: "English",
		  };

		const output = await app.invoke(input, config);
		console.log(output.messages[output.messages.length - 1]);

		return c.json(output.messages[output.messages.length - 1].content);
	});

export default app;
