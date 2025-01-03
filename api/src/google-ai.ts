import { Hono } from 'hono';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
			//responseSchema : { POSITIVE: "positive", NEUTRAL: "neutral", NEGATIVE: "negative"}
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
			return all.results.map(col => [col.name, col.type]);
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
							nullable: false,
							parameters: {
								type: 'object',
								properties: {},
								required: [],
							},
						},
						{
							name: 'describeTable',
							description: `Look up the table schema.
							 			Returns:
							 			List of columns, where each entry is a tuple of (column name, column type).`,
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

		const functionCalls = result.response.functionCalls();

		console.log(functionCalls);

		for (const call of functionCalls) {
			if (call.name === 'listTables') {
				const listTablesResponse = await listTables();
			}
			if (call.name === 'describeTable') {
				const describeTableResponse = await describeTable(call.parameters);
			}
			if (call.name === 'executeQuery') {
				const executeQueryResponse = await executeQuery(call.parameters);
			}
		}
		return c.json(result.response.text());
	});

export default app;
