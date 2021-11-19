import { GameState, Move } from './gamestate.js';

// Used to send the entire game state via the socket
export function EncodeGameState(state) {
	const encodedState = state;

	// Clone points without all the extra function stuff
	const statePoints = state.boardState.points;
	const encodedPoints = [];
	for (let x=0; x<state.boardSize; x++) {
		encodedPoints[x] = [];
		for (let y=0; y<state.boardSize; y++) {
			const p = statePoints[x][y];
			encodedPoints[x][y] = {
				x: p.x,
				y: p.y,
				horizontalLine: p.horizontalLine,
				verticalLine: p.verticalLine,
			}
		}
	}

	// Clone squares without all the extra function stuff
	const stateSquares = state.boardState.squares;
	const encodedSquares = [];
	for (let x=0; x<state.boardSize - 1; x++) {
		encodedSquares[x] = [];
		for (let y=0; y<state.boardSize - 1; y++) {
			const s = stateSquares[x][y];
			encodedSquares[x][y] = {
				x: s.x,
				y: s.y,
				ownership: s.ownership,
			}
		}
	}

	// Create boardState without all the extra function stuff
	encodedState.boardState = {
		size: state.boardState.size,
		points: encodedPoints,
		squares: encodedSquares,
	};


	return encodedState;
}

// Used to construct game state object via the socket
export function DecodeGameState(state) {
	// Initialise new game state
	const decodedState = new GameState(); 
	decodedState.Init(state.boardSize, state.playersTurn);

	// Set point values
	const encodedPoints = state.boardState.points;
	for (let x=0; x<state.boardSize; x++) {
		for (let y=0; y<state.boardSize; y++) {
			const point = encodedPoints[x][y];
			decodedState.board.points[x][y].x = point.x;
			decodedState.board.points[x][y].y = point.y;
			decodedState.board.points[x][y].horizontalLine = point.horizontalLine;
			decodedState.board.points[x][y].verticalLine = point.verticalLine;
		}
	}

	// Set square values
	const encodedSquares = state.boardState.squares;
	for (let x=0; x<state.boardSize - 1  ; x++) {
		for (let y=0; y<state.boardSize - 1; y++) {
			const square = encodedSquares[x][y];
			decodedState.board.squares[x][y].x = square.x;
			decodedState.board.squares[x][y].y = square.y;
			decodedState.board.squares[x][y].ownership = square.ownership;
		}
	}

	return decodedState;
}

// Used to send a move via the socket
export function EncodeMove(move) {
	return {
		x: move.x,
		y: move.y,
		isHorizontal: move.isHorizontal,
		madeBy: move.madeBy,
	};
}

// Used to recieve a move via the socket
export function DecodeMove(move) {
	return new Move(move.x, move.x, move.isHorizontal, move.madeBy);
}