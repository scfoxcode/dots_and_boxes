import { GameState, Ownership, SocketMessages } from '../shared/gamestate.js';
import {
	EncodeGameState,
	EncodeMove,
	DecodeGameState,
	DecodeMove,
} from '../shared/networking.js'; 
import uuid4 from 'uuid4';

function ReceiveMoveFromPlayer(data) {
	const { io, players, observers, state, move } = data;
	// Check the move is from the expected player. If not, mark it as illegal and game over

	state.boardState.ApplyMove(move, state.playersTurn);

	if (state.gamerOver) {
		// Can we send a victory message then delete our own references?
		// We probably want a server command to reset state, rather than it happen automatically
	} else {
		RequestMoveFromPlayer(state, player);
	}
}

export function PlayGame() {
	this.Init();
}

PlayGame.prototype.Init = function (boardSize = 10, playersTurn = Ownership.PLAYER1) {
	console.log('Initialising Game...');
	this.state = new GameState();
	this.started = false;
	this.state.Init(boardSize, playersTurn);
	this.players = {
		Player1: null,
		Player2: null,
	};
	this.observers = [];
	this.move = null;
	this.outstandingRequests = [];
}

PlayGame.prototype.AddPlayer = function(socket) {
	console.log('Player connected');
	if (this.players.Player1 && this.players.Player2) {
		socket.disconnect();
		console.log('Player cannot join, both spots are filled');
		return;
	}
	const freeSlot = this.players.Player1 ? Ownership.PLAYER2: Ownership.PLAYER1;
	this.players[freeSlot] = socket;
	socket.emit(SocketMessages.SET_PLAYER, freeSlot);

}

PlayGame.prototype.AddObserver = function (socket) {
	console.log('Observer connected');
	this.observers.push(socket);
	socket.emit(SocketMessages.SET_PLAYER, {player: Ownership.OBSERVER, state: this.state});
}

PlayGame.prototype.StartGame = function () {
	this.started = true;

	// Listen for player moves 
	const playerKeys = Object.keys(this.players);
	playerKeys.forEach(key => {
		const player = this.players[key];
		player.on(SocketMessages.SEND_MOVE, move => {
			console.log(`Received move from player  ${key}`);
			if (state.playerTurn !== key) {
				this.console.log(`Player ${key} played a move when it was not their turn`);
				// Disqualified
				const winner = key === Ownership.Player1 ? Ownership.Player2 : Ownership.Player1; 
				this.state.SetWinner(winner);
			}
			this.move = move;
			this.move.madeBy = key;
			ReceiveMoveFromPlayer(data);
		});
	});

	// Sent initial move request
	this.RequestMoveFromPlayer(data);
}

PlayGame.prototype.RequestMove = function() {
	const time = new Date();
	const expected = new Date();
	expected.setSeconds(time.getSeconds() + 2);

	const turn = this.state.playersTurn;

	// Get the socket for this player
	const player = this.players[turn]; 

	// Build a request for the player, containing all the data they need
	const request = {
		type: SocketMessages.REQUEST_MOVE,
		player: turn,
		sentAt: time,
		expectedBy: expected,
		requestId: uuid4(),  
		data: {
			encodedGameState: EncodeGameState(this.state),
			encodedLastMove: this.move ? EncodeMove(this.move) : null,
		},
	};
	this.outstandingRequests.push(request);

	// Send move to player
	player.emit(request.type, request); 

	const observerRequest = new request();
	observerRequest.type = SocketMessages.STATE_UPDATE,

	// Update all the observers
	observers.forEach(observer => observer.emit(observerRequest.type, observerRequest));
}

// Need to clear things up, clear the SEND_MOVE LISTENERS
PlayGame.prototype.EndGame = function() {
}