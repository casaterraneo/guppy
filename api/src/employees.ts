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
		vectors.push({ id: `${ids[i]}`, values: vector });
	}

	let inserted = await c.env.VECTORIZE.upsert(vectors);

	console.log(inserted);

	const modelSearch = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
		text: searchText,
	});
	const vector = modelSearch.data[0];
	const queryResult = await c.env.VECTORIZE.query(vector, { topK: 1 });

	const searchResults = await db
		.prepare(`SELECT * FROM [Employee] where Id=?`)
		.bind(queryResult.matches[0].id)
		.all();

	return c.json(searchResults.results);
});

export default app;
