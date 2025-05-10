import { Hono } from 'hono';
import * as Papi from './Papi';

const app = new Hono()
	.get('/:username', async c => {
		const userName = c.req.param('username');
		if (!userName) return c.json({ error: 'UserName is required' }, 400);

		const player1 = new Papi.Player();
		player1.name = `${userName}|X`;

		const player2 = new Papi.Player();
		player2.name = `${userName}|O`;

		const game = new Papi.Game();
		game.gameId = `${userName}|${userName}`;
		game.playerList.push(player1, player2);

		return c.json(game);
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
