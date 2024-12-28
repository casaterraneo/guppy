import { Hono } from 'hono';

// Middleware per verificare i permessi
function checkPermission(permission) {
	return (c, next) => {
		const user = c.get('user');
		if (user && user.permissions && user.permissions.includes(permission)) {
			return next();
		} else {
			return c.json({ error: 'Insufficient permissions' }, 403);
		}
	};
}

function formatFieldsToSql(fields, separator = ' ') {
	const fieldArray = fields.split(',');
	const formattedFields = fieldArray
	  .map(field => `COALESCE(${field.trim()}, '')`)
	  .join(` || '${separator}' || `);
	return `${formattedFields} AS text`;
  }


const app = new Hono().get('/', checkPermission('read:employees'), async c => {
	const searchConfigId = c.req.query('searchConfigId');
	const searchText = c.req.query('searchText');
	const db = c.get('db');

	if (!searchConfigId || !searchText) {
		const all = await db.prepare(`SELECT * FROM [Employee]`).all();
		return c.json(all.results);
	}

	const searchConfiguration = await db
		.prepare(`SELECT * FROM [SearchConfigurations] where Id=?`)
		.bind(searchConfigId)
		.first();

	if (searchConfiguration === null) {
		return c.status(404);
	}

	const searchFieldResults = await db
		.prepare(`SELECT Id, ${formatFieldsToSql(searchConfiguration.SearchFields)} FROM [Employee] order by id`)
		.all();

	const ids = searchFieldResults.results.map(r => r?.Id) as Array<string>;
	const text = searchFieldResults.results.map(r => r?.text) as Array<string>;

	const modelResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
		text: text,
	});

	let vectors: VectorizeVector[] = [];
	for (let i = 0; i < modelResp.data.length; i++) {
		let vector = modelResp.data[i];
		vectors.push({
			id: `${searchConfigId}_${ids[i]}`,
			values: vector,
			namespace: searchConfigId
		});
	}

	await c.env.VECTORIZE.upsert(vectors);

	const modelSearch = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
		text: searchText,
	});
	const vector = modelSearch.data[0];
	const queryResult = await c.env.VECTORIZE.query(vector, { topK: 3, namespace: searchConfigId });

	const commas = "?".repeat(queryResult.matches.length).split("").join(", ");
	const vectoreIds = queryResult.matches.map(match => match.id.replace(`${searchConfigId}_`, ""));

	const searchResults = await db
		.prepare(`SELECT * FROM [Employee] where Id IN (${commas})`)
		.bind(...vectoreIds)
		.all();

	// const scoreMap = new Map(queryResult.matches.map(match => [match.id, match.score]));

	// const itemsWithScores = searchResults.results.map(item => ({
	// 	...item,
	// 	Score: scoreMap.get(item.Id) || 0
	//   }));

	const itemsWithScores = async (searchResults) => {
		const items = [];

		for (const item of searchResults.results) {

			const match = queryResult.matches.find(match => match.id.replace(`${searchConfigId}_`, "") === item.Id.toString());

			const prompt = `You are a helpful and informative bot that answers questions using text from the reference passage included below in json format.
			Be sure to respond in a complete sentence, being comprehensive, including all relevant background information.
			However, you are talking to a non-technical audience, so be sure to break down complicated concepts and
			strike a friendly and converstional tone. If the passage is irrelevant to the answer, you may ignore it.

			QUESTION: ${searchText}
			PASSAGE: ${JSON.stringify(item)}`;

			console.log(prompt);

			const answer = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
				prompt: prompt,
			});

			//console.log(answer);
			console.log(answer.response);

			items.push({
				...item,
				Score: match ? match.score : 0,
				Answer: answer.response
				});
		}

		return items;
	};

	const sortedItems = await itemsWithScores(searchResults);
	sortedItems.sort((a, b) => b.Score - a.Score);

	return c.json(sortedItems);
});

export default app;
