function connect() {
	const address = document.getElementById('address').value;
	console.log(`Connect to the server on: ${address}`);
	const socket = io(
		address, {
		query: {
			type: 'Observer'
		}
	});
}