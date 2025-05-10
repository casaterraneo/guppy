import { Player } from './Player';

export class Game {
    gameId: string = '';
    playerList: Player[] = [];
	itemList: string[] = ["X", "X", "X", "X", "X", "O", "O", "O", "O"];
	board: string[] = new Array(9).fill("");
}
