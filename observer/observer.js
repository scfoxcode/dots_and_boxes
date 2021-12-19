import io from 'socket.io-client'
import { RenderGame } from './shaders'
import * as gamestate from '../shared/gamestate'
import {
	DecodeGameState,
} from '../shared/networking.js'; 

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
		const { player } = data;
		console.log(`Player Set: ${player}`);

		const connectionForm = document.getElementById('connectionForm');
		const gameGrid = document.getElementById('gameGrid');
		connectionForm.style.display = 'none';
		gameGrid.style.display = 'grid';
		
		// ONLY HERE FOR TESTING!!!
		// const canvas = document.getElementById('gameCanvas');
		// RenderGame(canvas, {boardSize: 10});
	});

	socket.on(gamestate.SocketMessages.STATE_UPDATE, msg => {
		// console.log('Game state received', msg);
		console.log('Last move', msg.data.encodedLastMove);
		const canvas = document.getElementById('gameCanvas');
		const decodedState = DecodeGameState(msg.data.encodedGameState);
		RenderGame(canvas, decodedState);
	});
}
