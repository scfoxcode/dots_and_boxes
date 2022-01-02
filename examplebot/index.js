const port = process.argv[2] || 5000;
const DEV = process.argv[3] && process.argv[3] === 'dev';

// Create bot
import readline from 'readline';
import { io } from 'socket.io-client';
import { SocketMessages } from '../shared/gamestate.js';
import { DecodeGameState, EncodeMove } from '../shared/networking.js';
let socket = null;

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

function ListenForServerMessages() {
    if (!socket) {
        console.log('Socket is null, cannot listen for messages');
    }
	socket.on(SocketMessages.REQUEST_MOVE, request => { 
		console.log('Server requested a move', request);
		const move = pickRandomMove(request);
		const response = buildMoveResponse(request, move);
		socket.emit(response.type, response);
	});
	socket.on(SocketMessages.STATE_UPDATE, data => { 
		console.log('State update received. Doing nothing, not implemented', data);
	});
}

/***** START HANDLE TERMINAL INPUT *****/
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
rl.setPrompt('bot$: ');
rl.prompt();

const commands = {
	'help': {
		action: () => {
			validCommands.forEach((vc) => {
				const command = vc.key; 
				console.log(`'${command}' - ${commands[command].man}`);
			});
		},
		man: 'Lists all bot commands with descriptions',
		rg: /help/i,
	},
	'connect': { // need a regex solution here to get address from the command
		action: (data) => {
			const address = data?.[1] || '127.0.0.1';
			const wsAddress = `ws://${address}:${port}`;
			console.log(`Socket connecting on address: ${wsAddress}`);
			socket = io(wsAddress, {
				query: {
					type: 'PLAYER',
					name: 'Example Bot'
				}
			});
            ListenForServerMessages();
		},
		man: 'Connects to a game, eg. \"connect 192.168.1.4\"',
		rg: /connect (.+)$/i,
	},
}

const validCommands = Object.keys(commands).map(c => ({key: c, rg: commands[c].rg}));

rl.on('line', (input) => {
	const command =  validCommands.find(c => c.rg.test(input));
	console.log(JSON.stringify(command));
	if (command) {
		const data = input.match(command.rg);
		commands[command.key].action(data);
	} else {
		console.log('Unknown Command. Type help to see a list of commands');
	}
	rl.prompt();
});
/***** END HANDLE TERMINAL INPUT *****/

// Handle dev mode for quick action
if (DEV) {
	console.log('ALERT, DEV MODE ACTIVE!');
	commands.connect.action();
}
