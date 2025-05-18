import { Player } from './Player';

export type GameMode = 'local' | 'remote';
export type GamePhase = 'start' | 'end';

export class Game {
	gameId: string = '';
	playerList: Player[] = [];
	itemList: string[] = ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'];
	board: string[][] = Game.createEmptyBoard(3);
	phase: GamePhase = 'start';
	gameMode: GameMode = 'local';

	static createEmptyBoard(size: number): string[][] {
		return Array.from({ length: size }, () => Array(size).fill(''));
	}
}
