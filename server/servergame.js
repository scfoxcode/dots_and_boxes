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
	// socket.emit(SocketMessages.SET_PLAYER, {player: Ownership.OBSERVER, state: this.state});
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
}

PlayGame.prototype.RequestMoveFromPlayer = function() {
	const time = new Date();
	const expected = new Date();
	expected.setSeconds(time.getSeconds() + 2);

	const turn = this.state.playersTurn;

	// Get the socket for this player
	const player = this.players[turn]; 

	console.log("TYPE OF 1", typeof this.state.boardState.ApplyMove);
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
	console.log("TYPE OF 2", typeof this.state.boardState.ApplyMove);

	// Send move to player
    console.log('Requesting move from player');
	player.emit(request.type, request); 

    const observerRequest = {...request};
	observerRequest.type = SocketMessages.STATE_UPDATE,

	// Update all the observers
	this.observers.forEach(observer => observer.emit(observerRequest.type, observerRequest));
}

PlayGame.prototype.ReceiveMoveFromPlayer = function (response) {
    console.log("Received move");
	// Check the move is from the expected player. If not, mark it as illegal and game over
	debugger;
    const encodedMove = response?.data?.encodedMove;
    if (!encodedMove) {
        console.log("Response was missing encoded move");
        // @TODO fail because move was not received. Declare other player the winner
    }
    if (!response?.requestId || !this.outstandingRequests.find(r => r.requestId === response.requestId)) {
        console.log("RequestId does not match");
        // This response does not match a request. Declare other player the winner
    }
    
    console.log("Decode the move", this.state.boardState);
    const move = DecodeMove(encodedMove);

	this.state.boardState.ApplyMove(move, this.state.playersTurn);

	if (this.state.gamerOver) {
		console.log("game is over");
		// Can we send a victory message then delete our own references?
		// We probably want a server command to reset state, rather than it happen automatically
	} else {
		this.RequestMoveFromPlayer();
	}
}

// Need to clear things up, clear the SEND_MOVE LISTENERS
PlayGame.prototype.EndGame = function() {
}
