import {
	GameState,
	Ownership,
	SocketMessages,
	Modes } from '../shared/gamestate.js';

import {
	EncodeGameState,
	EncodeMove,
	DecodeMove,
} from '../shared/networking.js'; 
import uuid4 from 'uuid4';

export function PlayGame(boardSize) {
	console.log('Building Game...');
	this.players = {
		PLAYER1: null,
		PLAYER2: null,
	};
	this.observers = [];
	this.round = 1;
	this.Init(boardSize);
}

PlayGame.prototype.Init = function (boardSize = 8, playersTurn = Ownership.PLAYER1) {
	console.log('Initialising Game...');
	this.state = new GameState();
	this.started = false;
	this.state.Init(boardSize, playersTurn);
	this.move = null;
	this.outstandingRequests = [];
}

PlayGame.prototype.NextRound = function () {
	this.round += 1;
	this.players.PLAYER1.socket.removeAllListeners([SocketMessages.SEND_MOVE]);
	this.players.PLAYER2.socket.removeAllListeners([SocketMessages.SEND_MOVE]);
	this.Init(this.state.boardSize, this.round % 2 === 0 ? Ownership.PLAYER2 : Ownership.PLAYER1);
	this.StartGame(this.mode); // need to remove listeners before this
}

PlayGame.prototype.AddPlayer = function(socket, name = 'BillyNoNames') {
	console.log('Player connected');
	if (this.players[Ownership.PLAYER1] && this.players[Ownership.PLAYER2]) {
		socket.disconnect();
		console.log('Player cannot join, both spots are filled');
		return;
	}
	const freeSlot = this.players[Ownership.PLAYER1] ? Ownership.PLAYER2: Ownership.PLAYER1;

	this.players[freeSlot] = {socket, name};

    console.log("Player joined in slot", freeSlot);
	socket.emit(SocketMessages.SET_PLAYER, freeSlot);

}

PlayGame.prototype.AddObserver = function (socket) {
	console.log('Observer connected');
	this.observers.push(socket);
	socket.emit(SocketMessages.SET_PLAYER, {player: Ownership.OBSERVER});
	this.UpdateObserver(socket);
}

PlayGame.prototype.StartGame = function (mode = Modes.STANDARD) {
	this.started = true;
	this.mode = mode;

	if (mode === Modes.SOLO) {
		// Create virtual player
	} else if (mode === Modes.SCREENSAVER) {
		// Create two virtual players and loop on game over
	}

	// Listen for player moves 
	const playerKeys = Object.keys(this.players);
	playerKeys.forEach(key => {
        if (!this.players[key]) {
            console.log('Player key', key);
            throw new Error('Not all players have connected. Throwing a tantrum');
        }
		const player = this.players[key].socket;
		player.on(SocketMessages.SEND_MOVE, response => {
			console.log(`Received move from player  ${key}`);
			this.ReceiveMoveFromPlayer(response);
		});
	});

	// Sent initial move request
	this.RequestMoveFromPlayer();
	this.UpdateObserversGameState();
}

PlayGame.prototype.AddOutstandingRequest = function(request, ms) {
	const self = this;
	const timeout = setTimeout(() => {
		console.log('Player took too long to respond to request', request);
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
            // when responding, players may only send data.encodedMove
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
	const storedRequest = this.RemoveOutstandingRequest(response.requestId);

	setTimeout(() => { // @TODO - remove timout. add proper timing. This was just for debugging
    console.log("Received move");
	// Check the move is from the expected player. If not, mark it as illegal and game over
    const encodedMove = response?.data?.encodedMove;
    if (!encodedMove) {
        console.log("Response was missing encoded move");
        // @TODO fail because move was not received. Declare other player the winner
    }
    if (!response?.requestId || !this.outstandingRequests.find(({request}) => request.requestId === response.requestId)) {
        console.log("RequestId does not match");
        // This response does not match a request. Declare other player the winner
    }
    
    console.log("Decode the move");
    const move = DecodeMove(encodedMove);
	this.move = move;
	this.move.madeBy = this.state.playersTurn;

	const squareWasCaptured = this.state.boardState.ApplyMove(move, this.state.playersTurn);

	// Check for legal moves. If none, game over
	const legalMoves = this.state.boardState.GetLegalMoves();
	console.log("legal moves left", legalMoves.length);
	if (legalMoves.length <= 0) {
		this.state.gameOver = true;
	}

	if (this.state.gameOver) {
		console.log("game is over");
	} else {
		if (!squareWasCaptured) {
			this.TogglePlayerTurn();
		}
		this.RequestMoveFromPlayer();
	}
	this.UpdateObserversGameState();
	}, 250);
}

// Need to clear things up, clear the SEND_MOVE LISTENERS
PlayGame.prototype.EndGame = function() {
}
