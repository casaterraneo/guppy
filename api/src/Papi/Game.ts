import { Player } from './Player';

export type GameMode = 'local' | 'remote';
export type GamePhase = 'init' | 'start' | 'end';

export class Game {
	gameId: string = '';
	playerList: Player[] = [];
	itemList: string[] = ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'];
	board: string[][] = Game.createEmptyBoard(3);
	phase: GamePhase = 'init';
	gameMode: GameMode = 'local';

	static createEmptyBoard(size: number): string[][] {
		return Array.from({ length: size }, () => Array(size).fill(''));
	}
}
