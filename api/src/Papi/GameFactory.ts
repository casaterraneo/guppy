import { Game, GameMode } from './Game';
import { Player } from './Player';

export class GameFactory {
	static create(userName: string, gameMode: GameMode): Game {
		const game = new Game();
		game.gameMode = gameMode;

		if (gameMode === 'local') {
			const player1 = new Player();
			player1.playerId = 'X';
			player1.name = userName;

			const player2 = new Player();
			player2.playerId = 'O';
			player2.name = userName;

			game.gameId = `${player1.name}|${player2.name}`;
			game.gamePhase = 'start';
			game.playerList.push(player1, player2);

			return game;
		}

		if (gameMode === 'remote' && userName.includes("player1")) {
			const player1 = new Player();
			player1.playerId = 'X';
			player1.name = userName;

			game.gameId = "player1@mail.com|player2@mail.com";
			game.gamePhase = 'init';
			game.playerList.push(player1);

			return game;
		}

		if (gameMode === 'remote' && userName.includes("player2")) {
			const player1 = new Player();
			player1.playerId = 'X';
			player1.name = "player1@mail.com";

			const player2 = new Player();
			player2.playerId = 'O';
			player2.name = userName;

			game.gameId = "player1@mail.com|player2@mail.com";
			game.gamePhase = 'start';
			game.playerList.push(player1, player2);

			return game;
		}
		throw new Error('Invalid game mode');
	}
}
