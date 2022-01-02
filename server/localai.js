import {
	SocketMessages,
	Ownership,
} from '../shared/gamestate.js';

import { pickRandomMove, buildMoveResponse } from '../shared/utilities.js';


// Used by the server for solo and screensaver game modes
export function LocalAI() {
	this.player = Ownership.NONE;
	this.callbacks = {};
}

// Fake socket function to handle server events
LocalAI.prototype.emit = function(message, data) {
	switch (message) {
		case SocketMessages.SET_PLAYER:
			this.player = data;
			break;

		case SocketMessages.REQUEST_MOVE:
			const move = pickRandomMove(data);
			const response = buildMoveResponse(data, move);
			if (this.callbacks[response.type]) {
				this.callbacks[response.type](response);
			} else {
				console.log(`Warning: No stored callback for server message ${response?.type}`);
			}
			break;

		default:
			console.log(`Warning: Fake emit does not handle ${message}. Not implemented`);
	}
}

// Fake socket function to store server callbacks for specific responses 
LocalAI.prototype.on = function(message, callback) {
	this.callbacks[message] = callback;
}

LocalAI.prototype.removeAllListeners = function() {
	this.callbacks = {};
}