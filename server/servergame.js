import { GameState } from '../shared/gamestate.js';


export function PlayGame(io) {
	const state = new GameState();
	state.InitBoard();
	console.log('Initialising Game...');
}