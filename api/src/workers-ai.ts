import { Hono } from 'hono';
import { runWithTools } from "@cloudflare/ai-utils";

const app = new Hono()
	.post('/llm', async c => {
		const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } =
			await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const answer = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
			text: messages[0],
		});

		return c.json(answer);
	})
	.post('/vector-upsert', async c => {
		const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } =
			await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const modelResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
			text: messages,
		});

		let vectors: VectorizeVector[] = [];
		let id = 1;
		modelResp.data.forEach(vector => {
			vectors.push({ id: `${id}`, values: vector });
			id++;
		});

		let inserted = await c.env.VECTORIZE.upsert(vectors);

		return c.json(inserted);
	})
	.post('/vector-query', async c => {
		const { messages, temperature, topK, topP, maxOutputTokens, responseMimeType, responseSchema } =
			await c.req.json();
		if (!messages) return c.json({ error: 'Message is required' }, 400);

		const modelResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
			text: messages[0],
		});

		const vector = modelResp.data[0];
		const result = await c.env.VECTORIZE.query(vector, { topK: 1 });

		return c.json(result.matches);
	})
	.post('/func-cal', async c => {
		// Define function
		const listTables = async () => {
			console.log(' - DB CALL: list_tables');
			const db = c.get('db');
			const all = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table';`).all();
			return all.results.map(row => row.name);
		};

		const describeTable = async (tableName) => {
			console.log(' - DB CALL: describe_table');
			const db = c.get('db');
			const all = await db.prepare(`PRAGMA table_info(${tableName});`).all();
			return all.results.map(col => [col.name, col.type]);
		};

		const executeQuery = async (sqlQuery) => {
			console.log(' - DB CALL: execute_query');
			const db = c.get('db');
			const all = await db.prepare(sqlQuery).all();
			return all.results;
		};

		// Run AI inference with function calling
		// const response = await runWithTools(
		// 	c.env.AI,
		const response = await c.env.AI.run(
			"@hf/nousresearch/hermes-2-pro-mistral-7b",
			{
			messages: [
				{ role: "system", content: `
You are a helpful chatbot that can interact with an SQL database for a computer
store. You will take the users questions and turn them into SQL queries using the tools
available. Once you have the information you need, you will answer the user's question using
the data returned. Use listTables to see what tables are present, describeTable to understand
the schema, and executeQuery to issue an SQL SELECT query.
` },
				{ role: "user", content: "Who are employees live in London?" },
			],
			tools: [
				{
					name: "listTables",
					//description: "Retrieve the names of all tables in the database.",
					description: "",
					parameters : {
						type: "object",
						properties: {},
						required: []
					  },
					function: listTables,
				},
				{
					name: "describeTable",
					// description: `Look up the table schema.
					// 			Returns:
					// 			List of columns, where each entry is a tuple of (column name, column type).`,
					description: "",
					parameters : {
						type: "object",
						properties: {
							tableName: {
							  type: "string",
							  description: "The name of the table to describe."
							}
						  },
						  required: ["tableName"]
					  },
					function: describeTable,
				},
				{
					name: "executeQuery",
					//description: `Execute a SELECT statement, returning the results.`,
					description: "",
					parameters : {
						type: "object",
						properties: {
							sqlQuery: {
							  type: "string",
							  description: "The sql to execute."
							}
						  },
						  required: ["sqlQuery"]
					  },
					function: executeQuery,
				},
			],
			},
			// {
			// 	verbose: true,
			// }
		);

		return c.json(response);
	});

export default app;
