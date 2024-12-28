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
		.prepare(`SELECT Id, ${searchConfiguration.SearchFields} FROM [Employee] order by id`)
		.all();

	const ids = searchFieldResults.results.map(r => r?.Id) as Array<string>;
	const names = searchFieldResults.results.map(r => r?.LastName) as Array<string>;

	const modelResp = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
		text: names,
	});

	let vectors: VectorizeVector[] = [];
	for (let i = 0; i < modelResp.data.length; i++) {
		let vector = modelResp.data[i];
		vectors.push({
			id: `${searchConfiguration.Id}_${ids[i]}`,
			values: vector,
			namespace: `${searchConfiguration.Id}`
		});
	}

	let inserted = await c.env.VECTORIZE.upsert(vectors);

	console.log(inserted);

	const modelSearch = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
		text: searchText,
	});
	const vector = modelSearch.data[0];
	const queryResult = await c.env.VECTORIZE.query(vector, { topK: 3, namespace: `${searchConfiguration.Id}` });

	const commas = "?".repeat(queryResult.matches.length).split("").join(", ");
	const vectoreIds = queryResult.matches.map(match => match.id.replace(`${searchConfiguration.Id}_`, ""));

	const searchResults = await db
		.prepare(`SELECT * FROM [Employee] where Id IN (${commas})`)
		.bind(...vectoreIds)
		.all();

	// const scoreMap = new Map(queryResult.matches.map(match => [match.id, match.score]));

	// const itemsWithScores = searchResults.results.map(item => ({
	// 	...item,
	// 	Score: scoreMap.get(item.Id) || 0
	//   }));

	const itemsWithScores = searchResults.results.map(item => {
		const match = queryResult.matches.find(match => match.id.replace(`${searchConfiguration.Id}_`, "") === item.Id.toString());
		console.log(match);
		return {
		  ...item,
		  Score: match ? match.score : 0
		};
	  });


	const sortedItems = itemsWithScores.sort((a, b) => b.Score - a.Score);

	return c.json(sortedItems);
});

export default app;
