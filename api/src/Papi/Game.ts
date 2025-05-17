import { Player } from './Player';

export class Game {
    gameId: string = '';
    playerList: Player[] = [];
	itemList: string[] = ["X", "O", "X", "O", "X", "O", "X", "O", "X"];
	board: string[] = new Array(9).fill("");
	phase: 'start' | 'end' = 'start';
}
