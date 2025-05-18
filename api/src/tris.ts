import { Hono } from 'hono';
import * as Papi from './Papi';

const app = new Hono()
	.get('/:userName/:gameMode', async c => {
		const userName = c.req.param('userName');
		const gameMode = c.req.param('gameMode');

		if (!userName) return c.json({ error: 'UserName is required' }, 400);
		if (!gameMode) return c.json({ error: 'GameMode is required' }, 400);

		const game = Papi.GameFactory.create(userName, gameMode);

		return c.json(game);
	})
	.get('clearDo/:gameId', async c => {
		const gameId = c.req.param('gameId');
		if (!gameId) return c.json({ error: 'GameId is required' }, 400);

		const id = c.env.TRIS_RECEIVER.idFromName(gameId);
		const stub = c.env.TRIS_RECEIVER.get(id);

		console.log('[clear DO]', gameId);
		stub.clearDo();

		return c.json(gameId);
	})
	.get('/', async c => {
		if (c.req.header('upgrade') !== 'websocket') {
			return c.text('Expected Upgrade: websocket', 426);
		}

		const gameId = c.req.query('gameId');

		console.log('[gameId for DO]', gameId);
		if (!gameId) {
			console.log('No gameId found');
			return c.text('No gameId found', 401);
		}

		const id = c.env.TRIS_RECEIVER.idFromName(gameId);
		const stub = c.env.TRIS_RECEIVER.get(id);

		return stub.fetch(c.req.raw);
	});

export default app;
