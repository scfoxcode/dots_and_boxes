const port = process.argv[2] || 5000;

// Create server, and initialise instance
import readline from 'readline';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PlayGame } from './servergame.js';
import { Ownership } from '../shared/gamestate.js';
const httpServer = createServer();
const io = new Server(httpServer, { 
		cors: {
			origin: '*',
		}
	}
);
const game = new PlayGame(); // Global game state object. Only 1 game may progress at a time

httpServer.listen(port, () => {
	console.log(`Server listening on port ${port} ...\n`);
	rl.setPrompt('server$: ');
	rl.prompt();
});

// Handle new connections
io.on('connection', (socket) => {
	switch (socket.handshake.query.type) {
		case Ownership.PLAYER:
			game.AddPlayer(socket);
			break;
		case Ownership.OBSERVER: 
			game.AddObserver(socket);
			break;
		default:
			console.log('Connection type not recognised');
			socket.disconnect();
	}
});

/***** START HANDLE TERMINAL INPUT *****/
// Import readline, and initialise instance
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const commands = {
	'help': {
		action: () => {
			validCommands.forEach((command) => {
				console.log(`'${command}' - ${commands[command].man}`);
			});
		},
		man: 'Lists all server commands with descriptions',
	},
	'show connected': {
		action: () => {},
		man: 'Lists connected players and observers',
	},
	'start game': {
		action: () => {
			if (!game) {
				console.log('Starting Game...');
				game.StartGame();
			} else {
				console.log('A game is already in progress');
			}
		},
		man: 'Starts a game. Requires two players to be connected'
	}
}

const validCommands = Object.keys(commands);

rl.on('line', (input) => {
	if (validCommands.find((c) => c === input)) {
		commands[input].action();
	} else {
		console.log('Unknown Command. Type help to see a list of commands');
	}
	rl.prompt();
});
/***** END HANDLE TERMINAL INPUT *****/
