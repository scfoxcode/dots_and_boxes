gameState = null;

function Initialise () {
	const canvas = document.getElementById('gameCanvas');
	InitialiseShaders(canvas);
}

function Draw() {
	const canvas = document.getElementById('gameCanvas');
	const gl = canvas.getContext('webgl');
	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function Connect() {
	const address = document.getElementById('address').value;
	console.log(`Connect to the server on: ${address}`);
	const socket = io(
		address, {
		query: {
			type: 'OBSERVER'
		}
	});

	socket.on('SET_PLAYER', data => { // Toggle view when we connect 
		const { player, state } = data;
		console.log(`Player Set: ${player}`);

		const connectionForm = document.getElementById('connectionForm');
		const gameGrid = document.getElementById('gameGrid');
		connectionForm.style.display = 'none';
		gameGrid.style.display = 'grid';

		Initialise();
		Draw();
	});

	socket.on('UPDATE_GAME_STATE', state => {
		console.log('Game state received');
	});

}

function viewGamestate() {

}