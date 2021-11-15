export const Ownership = Object.freeze({'NONE': 0, 'PLAYER1': 1, 'PLAYER2': 2, 'OBSERVER': 3});
export const Errors = Object.freeze({'ILLEGALMOVE': 'ILLEGALMOVE'});

export function Point(x, y) {
	this.x = Math.round(x);
	this.y = Math.round(y);
	this.horizontalLine = null;
	this.verticalLine = null;
}

export function Square(x, y) {
	this.x = Math.round(x);
	this.y = Math.round(y);
	this.points = []; // topLeft topRight bottomRight bottomLeft, handle to board.points
	this.ownership = Ownership.NONE;
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
		this.points[x] = [];
		for (let y=0; y<this.size - 1; y++) {
			const square = new Square(x, y);
			square.points[0] = this.points[x][y];
			square.points[1] = this.points[x + 1][y];
			square.points[2] = this.points[x + 1][y + 1];
			square.points[3] = this.points[x][y + 1];
		}
	}
}

export function IsSquareComplete(square) {
	const ownershipValues = [];
	ownershipValues.push(square.points[0].horizontalLine);
	ownershipValues.push(square.points[0].verticalLine);
	ownershipValues.push(square.points[1].verticalLine);
	ownershipValues.push(square.points[2].horizontalLine);
	return !ownershipValues.find(Ownership.NONE);
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
		if (square.ownership === Ownership.NONE && IsSquareComplete(square)) {
			square.ownershipo = player;
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
	if (point[directionKey] !== Ownership.NONE) {
		if (Array.isArray(errors)) {
			errors.push(new Error(`${Errors.ILLEGALMOVE} - Line already played x: ${move.x} y: ${move.y} ${directionKey} for player: ${player}`));
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

export function GameState() {
	this.turn = 0;
	this.playersTurn = Ownership.NONE; 
	this.illegalMove = false; // If this is ever true, game over
	this.boardSize = 10; // Board is always square, this is the number of dots
	this.boardState = null; // Will contain a board object
}

GameState.prototype.InitBoard = function (boardSize = 10) {
	this.boardSize = boardSize;
	this.boardState = new Board(this.boardSize);
	this.boardState.Init();
}


