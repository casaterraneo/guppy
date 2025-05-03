import { Hono } from 'hono';

const app = new Hono()
	.get('/:username', async c => {
		const username = c.req.param('username');
		if (!username) return c.json({ error: 'UserName is required' }, 400);

		const game =
		{
			gameId: username + '|' + username,
			playerList: [username + '|X', username + '|O' ]
		};

		return c.json(game);
	})
	.get('/', async c => {
		if (c.req.header('upgrade') !== 'websocket') {
			return c.text('Expected Upgrade: websocket', 426);
		}

		const username = c.req.query('username');

		console.log('[user.name for DO]', username);
		if (!username) {
			console.log('No user found');
			return c.text('No user found', 401);
		}

		const id = c.env.TRIS_RECEIVER.idFromName(username);
		const stub = c.env.TRIS_RECEIVER.get(id);

		return stub.fetch(c.req.raw);
	});

export default app;
