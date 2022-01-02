import {
	GameState,
	Ownership,
	SocketMessages,
	PlayerType,
	Modes } from '../shared/gamestate.js';

import {
	EncodeGameState,
	EncodeMove,
	DecodeMove,
} from '../shared/networking.js'; 
import uuid4 from 'uuid4';

import { LocalAI } from './localai.js';

export function PlayGame(boardSize, mode=Modes.STANDARD) {
	console.log('Building Game...');
	this.mode = mode;
	this.players = {
		PLAYER1: null,
		PLAYER2: null,
	};
	this.observers = [];
	this.round = 1;
	this.Init(boardSize);

	if (mode === Modes.SCREENSAVER) {
		const playForever = () => {
			setTimeout(() => {
				this.NextRound(playForever);
			}, 3000);
		};
		this.StartGame(playForever);
	}
}

PlayGame.prototype.Init = function (boardSize = 8, playersTurn = Ownership.PLAYER1) {
	console.log('Initialising Game...');
	this.state = new GameState();
	this.started = false;
	this.state.Init(boardSize, playersTurn);
	this.move = null;
	this.outstandingRequests = [];
}

PlayGame.prototype.NextRound = function (callback) {
	this.round += 1;
	this.players.PLAYER1.socket.removeAllListeners([SocketMessages.SEND_MOVE]);
	this.players.PLAYER2.socket.removeAllListeners([SocketMessages.SEND_MOVE]);
	this.Init(this.state.boardSize, this.round % 2 === 0 ? Ownership.PLAYER2 : Ownership.PLAYER1);
	this.StartGame(callback);
}

PlayGame.prototype.AddPlayer = function(socket, name = 'BillyNoNames', type=PlayerType.REMOTE_BOT) {
	console.log(`Player "${name}"(${type}) connected`);

	if (!socket) {
		socket = new LocalAI();
	}

	if (this.players[Ownership.PLAYER1] && this.players[Ownership.PLAYER2]) {
		socket.disconnect();
		console.log('Player cannot join, both spots are filled');
		return;
	}

	const freeSlot = this.players[Ownership.PLAYER1] ? Ownership.PLAYER2: Ownership.PLAYER1;

	this.players[freeSlot] = {socket, name, type };

    console.log(`Player joined in slot ${freeSlot}`);

	socket.emit(SocketMessages.SET_PLAYER, freeSlot);
	this.UpdateObserversGameState();
}

PlayGame.prototype.AddObserver = function (socket) {
	console.log('Observer connected');
	this.observers.push(socket);
	socket.emit(SocketMessages.SET_PLAYER, {player: Ownership.OBSERVER});
	this.UpdateObserver(socket);
}

PlayGame.prototype.StartGame = function (callback) {
	this.started = true;
	this.state.SetGameOverCallback(callback);

	// Clear existing local bots if any
	let playerKeys = Object.keys(this.players);
	playerKeys.forEach(key => {
		if (this.players[key] && this.players[key].type === PlayerType.LOCAL_BOT) {
			this.players[key] = null;
		}
	});

	if (this.mode === Modes.SOLO) {
		this.AddPlayer(null, 'Server_Bot', PlayerType.LOCAL_BOT);
	} else if (this.mode === Modes.SCREENSAVER) {
		this.AddPlayer(null, 'Server_Bot_1', PlayerType.LOCAL_BOT);
		this.AddPlayer(null, 'Server_Bot_2', PlayerType.LOCAL_BOT);
	}

	// Listen for player moves 
	playerKeys = Object.keys(this.players);
	playerKeys.forEach(key => {
		if (!this.players[key]) {
			console.log('Player key', key);
			throw new Error('Not all players have connected. Throwing a tantrum');
		}
		const player = this.players[key].socket;
		player.on(SocketMessages.SEND_MOVE, response => {
			console.log(`Received move from player ${key}`);
			this.ReceiveMoveFromPlayer(response);
		});
	});

	// Sent initial move request
	this.RequestMoveFromPlayer();
	
	// Always update any connected observers
	this.UpdateObserversGameState();
}

PlayGame.prototype.AddOutstandingRequest = function(request, ms) {
	const self = this;
	const timeout = setTimeout(() => {
		console.log(`Player "${request.player}" took too long to respond to request`, request);
		const winner = request.player === Ownership.PLAYER1 ? Ownership.PLAYER2 : Ownership.PLAYER1;
		self.state.SetWinner(winner, `${request.player} took too long to respond to request ${request.requestId}`);
	}, ms);	
	this.outstandingRequests.push({
		timeout,
		request
	});
}

PlayGame.prototype.RemoveOutstandingRequest = function(requestId) {
	const index = this.outstandingRequests.findIndex(({request}) => request.requestId === requestId);
	if (index > -1) {
		const req = this.outstandingRequests[index];
		if (req.timeout) {
			clearTimeout(req.timeout);
		}
		this.outstandingRequests.splice(index, 1);
		return req.request;
	}
	return null;
}

PlayGame.prototype.RequestMoveFromPlayer = function() {
	const timeAllowedInMs = 2000
	const time = new Date();
	const expected = new Date();
	expected.setSeconds(time.getSeconds() + timeAllowedInMs * 0.001);

	const turn = this.state.playersTurn;

	// Get the socket for this player
	const player = this.players[turn].socket; 

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
	this.AddOutstandingRequest(request, timeAllowedInMs);

	// Send move to player
    console.log('Requesting move from player');
	player.emit(request.type, request); 
}

PlayGame.prototype.UpdateObserver = function(observer) {
	const request = {
		type: SocketMessages.STATE_UPDATE,
		player: this.state.playersTurn,
		playerNames: {
			[Ownership.PLAYER1]: this.players[Ownership.PLAYER1]?.name,
			[Ownership.PLAYER2]: this.players[Ownership.PLAYER2]?.name
		},
		sentAt: new Date,
		data: {
			encodedGameState: EncodeGameState(this.state),
			encodedLastMove: this.move ? EncodeMove(this.move) : null,
		},
	};
	observer.emit(request.type, request);
}

PlayGame.prototype.UpdateObserversGameState = function() {
	this.observers.map(this.UpdateObserver.bind(this));
}

PlayGame.prototype.TogglePlayerTurn = function(player) {
	return this.state.TogglePlayerTurn(player);
}

PlayGame.prototype.ReceiveMoveFromPlayer = function (response) {
	if (this.state.gameOver) {
		return; // Ignore any moves if game is already over
	}

	setTimeout(() => { // We want a minimum delay between moves 
		// Check the move is from the expected player. If not, mark it as illegal and game over
		const encodedMove = response?.data?.encodedMove;
		if (!encodedMove) {
			console.log("Response was missing encoded move");
			// @TODO fail because move was not received. Declare other player the winner
		}
		if (!response?.requestId || !this.outstandingRequests.find(({request}) => request.requestId === response.requestId)) {
			console.log(`RequestId "${response?.requestId}" does not match`);
			return; // Ignore requests that do not match
			// This response does not match a request. Declare other player the winner
		}
		this.RemoveOutstandingRequest(response.requestId);
		
		console.log("Decode the move");
		const move = DecodeMove(encodedMove);
		this.move = move;
		this.move.madeBy = this.state.playersTurn;

		const squareWasCaptured = this.state.boardState.ApplyMove(move, this.state.playersTurn);

		// Check for legal moves. If none, game over
		const legalMoves = this.state.boardState.GetLegalMoves();
		console.log("legal moves left", legalMoves.length);
		if (legalMoves.length <= 0) {
			const winner = this.state.WhoOwnsMore();
			this.state.SetWinner(winner);
		}

		if (this.state.gameOver) {
			console.log(`Game is over. ${this.state.victor} won.`);
		}
		else {
			if (!squareWasCaptured) {
				this.TogglePlayerTurn();
			}
			this.RequestMoveFromPlayer();
		}
		this.UpdateObserversGameState();
	}, 100);
}
