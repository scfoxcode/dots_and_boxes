import io from 'socket.io-client'
import { HackyDraw, RenderGame } from './shaders'
import * as gamestate from '../shared/gamestate'
import {
	DecodeGameState,
} from '../shared/networking.js'; 

// Got to love a few global variables...
let gameState = null;
let dotCellShader = null;
let lineShader = null;

window.Connect = function () {
	const address = document.getElementById('address').value;
	console.log(`Connect to the server on: ${address}`);
	const socket = io(
		address, {
		query: {
			type: 'OBSERVER'
		}
	});

	socket.on(gamestate.SocketMessages.SET_PLAYER, data => { // Toggle view when we connect 
		const { player, state } = data;
		console.log(`Player Set: ${player}`);

		const connectionForm = document.getElementById('connectionForm');
		const gameGrid = document.getElementById('gameGrid');
		connectionForm.style.display = 'none';
		gameGrid.style.display = 'grid';

		const canvas = document.getElementById('gameCanvas');
		HackyDraw(canvas); // we should not be reinitialising everything on each draw call, that's insane
	});

	socket.on(gamestate.SocketMessages.STATE_UPDATE, msg => {
		console.log('Game state received', msg);
		const canvas = document.getElementById('gameCanvas');
		const decodedState = DecodeGameState(msg.data.encodedGameState);
		RenderGame(canvas, decodedState);
	});
}
