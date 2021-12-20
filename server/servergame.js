import { GameState, Ownership, SocketMessages } from '../shared/gamestate.js';
import {
	EncodeGameState,
	EncodeMove,
	DecodeGameState,
	DecodeMove,
} from '../shared/networking.js'; 
import uuid4 from 'uuid4';

export function PlayGame() {
	this.Init();
}

PlayGame.prototype.Init = function (boardSize = 10, playersTurn = Ownership.PLAYER1) {
	console.log('Initialising Game...');
	this.state = new GameState();
	this.started = false;
	this.state.Init(boardSize, playersTurn);
	this.players = {
		PLAYER1: null,
		PLAYER2: null,
	};
	this.observers = [];
	this.move = null;
	this.outstandingRequests = [];
}

PlayGame.prototype.AddPlayer = function(socket) {
	console.log('Player connected');
	if (this.players[Ownership.PLAYER1] && this.players[Ownership.PLAYER2]) {
		socket.disconnect();
		console.log('Player cannot join, both spots are filled');
		return;
	}
	const freeSlot = this.players[Ownership.PLAYER1] ? Ownership.PLAYER2: Ownership.PLAYER1;
	this.players[freeSlot] = socket;
    console.log("Player joined in slot", freeSlot);
	socket.emit(SocketMessages.SET_PLAYER, freeSlot);

}

PlayGame.prototype.AddObserver = function (socket) {
	console.log('Observer connected');
	this.observers.push(socket); // need to fix this request and encode state properly
	socket.emit(SocketMessages.SET_PLAYER, {player: Ownership.OBSERVER});
	this.UpdateObserver(socket);
}

PlayGame.prototype.StartGame = function () {
	this.started = true;

	// Listen for player moves 
	const playerKeys = Object.keys(this.players);
	playerKeys.forEach(key => {
        if (!this.players[key]) {
            console.log('Player key', key);
            throw new Error('Not all players have connected. Throwing a tantrum');
        }
		const player = this.players[key];
		player.on(SocketMessages.SEND_MOVE, response => {
			console.log(`Received move from player  ${key}`);
			/*
			if (state.playerTurn !== key) {
				this.console.log(`Player ${key} played a move when it was not their turn`);
				// Disqualified
				const winner = key === Ownership.PLAYER1 ? Ownership.PLAYER2 : Ownership.PLAYER1; 
				this.state.SetWinner(winner);
			}
			*/
			this.ReceiveMoveFromPlayer(response); // Move the above into this function
		});
	});

	// Sent initial move request
	this.RequestMoveFromPlayer();
	this.UpdateObserversGameState();
}

PlayGame.prototype.RequestMoveFromPlayer = function() {
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
            // when responding, players may only send data.encodedMove
		},
	};
	this.outstandingRequests.push(request);

	// Send move to player
    console.log('Requesting move from player');
	player.emit(request.type, request); 
}

PlayGame.prototype.UpdateObserver = function(observer) {
	const request = {
		type: SocketMessages.STATE_UPDATE,
		player: this.state.playersTurn,
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

PlayGame.prototype.ReceiveMoveFromPlayer = function (response) {
	setTimeout(() => { // @TODO - remove timout. add proper timing. This was just for debugging
    console.log("Received move");
	// Check the move is from the expected player. If not, mark it as illegal and game over
    const encodedMove = response?.data?.encodedMove;
    if (!encodedMove) {
        console.log("Response was missing encoded move");
        // @TODO fail because move was not received. Declare other player the winner
    }
    if (!response?.requestId || !this.outstandingRequests.find(r => r.requestId === response.requestId)) {
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
		// Can we send a victory message then delete our own references?
		// We probably want a server command to reset state, rather than it happen automatically
	} else {
		if (!squareWasCaptured) {
			this.state.playersTurn = this.state.playersTurn === Ownership.PLAYER1 ? Ownership.PLAYER2 : Ownership.PLAYER1;
		}
		this.RequestMoveFromPlayer();
	}
	this.UpdateObserversGameState();
	}, 100);
}

// Need to clear things up, clear the SEND_MOVE LISTENERS
PlayGame.prototype.EndGame = function() {
}
