const port = process.argv[2] || 5000;

// Create bot
import readline from 'readline';
import { io } from 'socket.io-client';
import { Ownership } from '../shared/gamestate.js';
let socket = null;

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
			const address = data[1] || '127.0.0.1';
			const wsAddress = `ws://${address}:${port}`;
			console.log(`Socket connecting on address: ${wsAddress}`);
			socket = io(wsAddress, {
				query: {
					type: 'PLAYER'
				}
			});
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
