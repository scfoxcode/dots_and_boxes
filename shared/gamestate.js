function Point(x, y) {
	this.x = x;
	this.y = y;
}

Point.prototype.Equals = function(point) {
	return (this.x === point.x && this.y === point.y);
}

function Line(x1, y1, x2, y2, ownership = -1) {
	this.ownership = ownership;
	this.points = [new Point(x1, y1), new Point(x2, y2)];
}

// Helper to reduce searches needed
Line.prototype.IsHorizontal = function() {
	return this.points[0].y === this.points[1].y;
}

// Compares the location of two lines, ignores ownership
Line.prototype.LineLocationsMatch = function(line) {
	return (this.points[0].Equals(line.points[0]) &&
			this.points[1].Equals(line.points[1])) ||
			(this.points[0].Equals(line.points[1]) &&
			this.points[1].Equals(line.points[0]));
}

function GameState() {
	this.turn = 0;
	this.playersTurn = 0; // Alternate between 0 and 1
	this.illegalMove = false; // If this is ever true, game over
	this.boardSize = 10; // Board is always square, this is the number of dots
	this.ownership = []; // Array of nums for square ownership, -1 for un-owned, after that player number
	this.horizontalLines = [];
	this.verticalLines = [];
}

GameState.prototype.LegalMoves = function () {
	const lines = [...this.horizontalLines, ...this.verticalLines];
	return lines.filter(l => l.ownership === -1);
}

function FindLineIfLegal(state, line) {
	// Find the line in state that matches the provided line
	const searchList = line.IsHorizontal() ? state.horizontalLines : state.verticalLines;
	const foundLines = searchList.filter(l => l.LineLocationsMatch(line));
	if (!foundLines.length || foundLines[0].ownership !== -1) {
		return false;
	}
	return foundLines[0];
}

function ApplyMove(state, line) {
	const legalLine = FindLineIfLegal(state, line);
	if (!legalLine) {
		return false;
	}
	// Update line
	legalLine.ownership = state.playersTurn;

	// Build a list of all squares this line is part of
	const squares = [];
	const xIndex = Math.min(legalLine.points[0].x, legalLine.points[1].x);	
	const xIndex = Math.min(legalLine.points[0].y, legalLine.points[1].y);	
	const yIndex = legalLine.points[0].y;
	const squaresWidth = boardSize - 1;
	if (legalLine.IsHorizontal()) {
		if (yIndex > 0) { // Push square above the line
			squares.push(Math.round(squaresWidth * (yIndex - 1) + xIndex));
		}
		if (yIndex < squaresWidth - 1) { // Push square below the line
			squares.push(Math.round(squaresWidth * yIndex + xIndex));
		}
	} else {
		if (xIndex > 0) { // Push square left of the line
			squares.push(Math.round(squaresWidth * yIndex + (xIndex - 1)));
		}
		if (xIndex < squaresWidth - 1) { // Push square right of the line
			squares.push(Math.round(squaresWidth * yIndex + xIndex));
		}
	}

	squares.forEach(square => {
		if (state.ownership[square] !== -1) {
			return;
		}
		// We need to check to see if this square is now completed
	});

}
