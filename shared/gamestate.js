export const Modes = Object.freeze({
	STANDARD: 'STANDARD',
	SOLO: 'SOLO',
	SCREENSAVER: 'SCREENSAVER'
});

export const Ownership = Object.freeze({
	NONE: 'NONE',
	PLAYER: 'PLAYER',
	PLAYER1: 'PLAYER1',
	PLAYER2: 'PLAYER2',
	OBSERVER: 'OBSERVER'
});

export const Errors = Object.freeze({
	ILLEGALMOVE: 'ILLEGALMOVE',
	NOT_THIS_PLAYERS_TURN: 'NOT_THIS_PLAYERS_TURN'
});

export const SocketMessages = Object.freeze({
	SET_PLAYER: 'SET_PLAYER',
	REQUEST_MOVE: 'REQUEST_MOVE',
	SEND_MOVE: 'SEND_MOVE',
	STATE_UPDATE: 'STATE_UPDATE',	
});

export function Point(x, y) {
	this.x = Math.round(x);
	this.y = Math.round(y);
	this.horizontalLine = null;
	this.verticalLine = null;
}

export function Square(x, y) {
	this.x = Math.round(x);
	this.y = Math.round(y);
	this.ownership = Ownership.NONE;
}

Square.prototype.GetPoints = function (points) {
	const x = this.x;
	const y = this.y;
	// topLeft topRight bottomRight bottomLeft
	return [
		points[x][y],
		points[x + 1][y],
		points[x + 1][y + 1],
		points[x][y + 1],
	];
}

export function Move(x, y, horizontal, player = Ownership.NONE) {
	this.x = Math.round(x);
	this.y = Math.round(y);
	this.isHorizontal = horizontal;
	this.madeBy = player;
}

export function Board(size) {
	this.size = Math.round(size);
	this.points = []; // 2D array of Point objects
	this.squares = []; // 2D array of Square objects
}


Board.prototype.Init = function () {
	// Initialise points
	for (let x=0; x<this.size; x++) {
		this.points[x] = [];
		for (let y=0; y<this.size; y++) {
			const point = new Point(x, y);
			if (x < this.size -1) {
				point.horizontalLine = Ownership.NONE;
			}
			if (y < this.size - 1) {
				point.verticalLine = Ownership.NONE;
			}
			this.points[x][y] = point;	
		}
	}

	// Initialise squares, careful, we have pointers here, might have to reconstruct if sending this state via network?
	for (let x=0; x<this.size -1; x++) {
		this.squares[x] = [];
		for (let y=0; y<this.size - 1; y++) {
			this.squares[x][y] = new Square(x, y);
		}
	}
}

Board.prototype.ApplyMove = function(move, player) {
	return ApplyMoveToBoard(this, move, player); 
}

Board.prototype.GetLegalMoves = function() {
	const legalMoves = [];
	for (let x=0; x<this.size; x++) {
		for (let y=0; y<this.size; y++) {
			if (this.points[x][y].horizontalLine === Ownership.NONE) {
				legalMoves.push(new Move(x, y, true, Ownership.NONE));
			}
			if (this.points[x][y].verticalLine === Ownership.NONE) {
				legalMoves.push(new Move(x, y, false, Ownership.NONE));
			}
		}
	}
	return legalMoves;
}

export function IsSquareComplete(square, points) {
	const ownershipValues = [];
	const squarePoints = square.GetPoints(points);
	ownershipValues.push(squarePoints[0].horizontalLine);
	ownershipValues.push(squarePoints[0].verticalLine);
	ownershipValues.push(squarePoints[1].verticalLine);
	ownershipValues.push(squarePoints[3].horizontalLine);
	const isCompleted = !ownershipValues.find(own => own === Ownership.NONE);
	return isCompleted;
}

// Returns true if a square was captured
export function UpdateSquaresAfterValidMove(board, move, player) {
	// Get squares that include the origin point in this move
	const squares = [];
	if (move.x > 0 && move.y > 0) { // top left should exist 
		squares.push(board.squares[move.x -1][move.y -1]);
	}
	if (move.x < board.size - 1 && move.y > 0) { // top right should exist
		squares.push(board.squares[move.x][move.y -1]);
	}
	if (move.x < board.size -1 && move.y < board.size -1) { // bottom right should exist
		squares.push(board.squares[move.x][move.y]);
	}
	if (move.x > 0 && move.y < board.size -1) { // bottom left should exist
		squares.push(board.squares[move.x -1][move.y]);
	}
	let squareWasCaptured = false;
	squares.forEach(square => {
		if (square.ownership === Ownership.NONE && IsSquareComplete(square, board.points)) {
			square.ownership = player;
			squareWasCaptured = true;
		}
	});
	return squareWasCaptured;
}

// Trusn true if move is legal, also fills in errors list if provided
export function IsMoveLegal(board, move, errors) {
	if (move.x >= board.size ||
		move.y >= board.size ||
		move.x < 0 ||
		move.y < 0) {
		if (Array.isArray(errors)) {
			errors.push(new Error(`${Errors.ILLEGALMOVE} - Move was out of bounds x: ${move.x} y: ${move.y} for board size: ${board.size}`));
		}
		return false;
	}
	const point = board.points[move.x][move.y];
	const directionKey = move.isHorizontal ? 'horizontalLine' : 'verticalLine';
	if (point[directionKey] && point[directionKey] !== Ownership.NONE) {
		if (Array.isArray(errors)) {
			errors.push(new Error(`${Errors.ILLEGALMOVE} - Line already played x: ${move.x} y: ${move.y} ${directionKey} for player: ${move.madeBy}`));
		}
		return false;
	}
	return true;
}

// Returns true if one or more squares were captured
export function ApplyMoveToBoard(board, move, player) {
	const errors = [];
	const legal = IsMoveLegal(board, move, errors);
	if (errors.length) {
		throw errors;
	} else {
		const point = board.points[move.x][move.y];
		const directionKey = move.isHorizontal ? 'horizontalLine' : 'verticalLine';
		point[directionKey] = player;
		const captured = UpdateSquaresAfterValidMove(board, move, player);
		return captured;
	}
}


export function GameState() {
	this.turn = 0;
	this.gameOver = false;
	this.victor = Ownership.NONE;
	this.playersTurn = Ownership.NONE; 
	this.boardSize = 10; // Board is always square, this is the number of dots. // Not respected by shaders yet
	this.boardState = null; // Will contain a board object
}

GameState.prototype.Init = function (boardSize = 10, playersTurn = Ownership.PLAYER1) {
	this.playersTurn = playersTurn;
	this.boardSize = boardSize;
	this.boardState = new Board(this.boardSize);
	this.boardState.Init();
}

GameState.prototype.SetWinner = function (winner) {
	this.gameOver = true;
	this.victor = winner;
}

GameState.prototype.TogglePlayerTurn = function(player) {
	if (player) {
		this.playersTurn = player;
	} else {
		this.playersTurn = this.playersTurn === Ownership.PLAYER1 ?
		Ownership.PLAYER2 :
		Ownership.PLAYER1;
	}
	return this.playersTurn;
}
