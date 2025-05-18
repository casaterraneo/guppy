import { Game, GameMode } from './Game';
import { Player } from './Player';

export class GameFactory {
	static create(userName: string, gameMode: GameMode): Game {
		const player1 = new Player();
		player1.playerId = 'X';
		player1.name = userName;

		const player2 = new Player();
		player2.playerId = 'O';
		player2.name = userName;

		const game = new Game();
		game.gameId = `${player1.name}|${player2.name}`;
		game.gameMode = gameMode;
		game.gamePhase = 'start';
		game.playerList.push(player1, player2);

		return game;
	}
}
