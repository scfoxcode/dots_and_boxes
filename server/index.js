const port = process.argv[2] || 5000;

// Create server, and initialise instance
const koa = require('koa');
const app = new koa();
const http = require('http').Server(app);
const io = require('socket.io')(http);

console.log("port", port);

http.listen(port, () => {
	console.log(`Server listening on port ${port} ...\n`);
	rl.setPrompt('server$: ');
	rl.prompt();
});

// Handle new connections
io.on('connection', (socket) => {
	
});

// Import readline, and initialise instance
const readline = require('readline');
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.on('line', (input) => {
	if (input === 'help') {
		console.log('Allowed Commands:');
	} else {
		console.log('Unknown Command. Type help to see a list of commands');
	}
	rl.prompt();
});


