
// Read in server config
const config = JSON.parse(
	await readFile(
		new URL('./config.json', import.meta.url)
	)
);

const port = process.argv[2] || config.default_port;
const mode = process.argv[3] || config.default_mode;

// Create server, and initialise instance
import { readFile } from 'fs/promises';
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

const game = new PlayGame(16); // Global game state object. Only 1 game may progress at a time

httpServer.listen(port, () => {
	console.log(`Server listening on port ${port} ...\n`);
	rl.setPrompt('server$: ');
	rl.prompt();
});

// Handle new connections
io.on('connection', (socket) => {
	switch (socket.handshake.query.type) {
		case Ownership.PLAYER:
			game.AddPlayer(socket, socket.handshake.query.name);
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
			if (!game.started) {
				console.log('Starting Game...');
				game.StartGame();
			} else {
				console.log('A game is already in progress');
			}
		},
		man: 'Starts a game. Requires two players to be connected in standard mode. One player for solo'
	},
	'next round': {
		action: () => {
			if (!game.started) {
				console.log('Cannot call "next round" before "start game"');
			} else {
				game.NextRound();
			}
		},
		man: 'Starts a new round using the existing connections, swaps the players'
	},
	'swap player': {
		action: () => {
			if (game.started) {
				console.log('Cannot swap player in a game that has already started');
			} else {
				game.TogglePlayerTurn();
			}
		},
		man: 'Swaps the player positions before starting a game'
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
