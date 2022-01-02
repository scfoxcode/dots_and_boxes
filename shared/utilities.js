export function pickRandomMove(request) {
	if (!request?.data?.encodedGameState) {
		console.log('Server failed to send game state');
	}
	const gamestate = DecodeGameState(request.data.encodedGameState);
	const legalMoves = gamestate.boardState.GetLegalMoves();
	const moveIndex = Math.floor(Math.random() * legalMoves.length);
	const chosenMove = legalMoves[moveIndex];
	console.log("chosen move", chosenMove.x, ' , ', chosenMove.y);
	return chosenMove;
}

export function buildMoveResponse(request, move) {
	const response = {
		type: SocketMessages.SEND_MOVE,
		player: request.turn,
		requestId: request.requestId, 
		data: {
			encodedMove: EncodeMove(move),
		},
	};
	return response;
}