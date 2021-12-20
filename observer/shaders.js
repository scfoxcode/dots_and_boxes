import { Ownership } from '../shared/gamestate'

const Colours = {
	ALPHA: [0.0, 0.0, 0.0, 0.0],
	BLACK: [0.0, 0.0, 0.0, 1.0],
	PLAYER1: [1.0, 0.0, 0.0, 0.5],
	PLAYER2: [0.0, 0.0, 1.0, 0.5],
	BOARDGREY: [0.97, 0.97, 0.97, 1.0]
};

const cellsVertexShaderCode = "\
    attribute vec2 a_position;\
    attribute vec4 a_colour;\
	varying vec4 col;\
    void main() {\
		col = a_colour;\
        gl_Position = vec4(a_position.xy, 0, 1);\
	}\
";

const cellsFragmentShaderCode = "\
	precision mediump float;\
	varying vec4 col;\
	void main() {\
		float gridS = 1000.0 / 10.0;\
		float halfG = gridS / 2.0;\
		float a = 5.0;\
		float b = 1.0;\
		float dx = mod(gl_FragCoord.x + halfG, gridS);\
		float dy = mod(gl_FragCoord.y + halfG, gridS);\
		if (((dx < a || dx > (gridS - a)) && (dy < b || dy > (gridS - b))) ||\
			((dx < b || dx > (gridS - b)) && (dy < a || dy > (gridS - a)))){\
			gl_FragColor = vec4(0.7, 0.7, 0.7, 1.0);\
		} else {\
			gl_FragColor = col;\
		}\
	}\
";

// @TODO - refactor shaders to handle any grid size. Currently locked to 10 dots
const linesVertexShaderCode = "\
    attribute vec2 a_position;\
    attribute vec4 a_colour;\
	varying vec4 col;\
    void main() {\
		col = vec4(a_colour.xyz, 0.9);\
		float magicSize = 5.0;\
		float gridS = 1000.0 / 10.0;\
		float halfG = gridS / 2.0;\
		float x = (a_position.x / magicSize) - 1.0 + 0.1;\
		float y = -(a_position.y / magicSize) + 0.8 + 0.1;\
        gl_Position = vec4(x, y, 0, 1);\
    }\
";

const linesFragmentShaderCode = "\
	precision mediump float;\
	varying vec4 col;\
	void main() {\
		gl_FragColor = col;\
	}\
";

/**
 * Function to select the requested shader, will compile and cache only if needed
 * gl - The open gl context for this shader, the cache will be added to this
 * name - Name we are giving to this shader program
 * fBuildProgram - Function that takes the gl context and returns the shader program
 */
function UseShaders(gl, name, fBuildProgram) {
	if (!gl.shaderMap) { // Store some shader state on the gl context
		gl.shaderMap = {};
	}
	if (!gl.shaderMap[name]) { // Look for already compiled shader
		gl.shaderMap[name] = fBuildProgram(gl);
	}
	return gl.shaderMap[name]();
}

/**
 * Function that returns a builder function for a given vertex and fragment shader
 * gl - The open gl context for this shader
 * vert - The raw vertex shader source code
 * frag - The raw fragment shader source code
 */
function BuildShader(gl, vert, frag) {
    // Compile and attach shaders
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vert);
    gl.compileShader(vShader);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fShader, frag);
    gl.compileShader(fShader);
	var error_log = gl.getShaderInfoLog(fShader);
	console.log(error_log);

	return () => {
		const program = gl.createProgram();
		gl.attachShader(program, vShader);
		gl.attachShader(program, fShader);
		gl.linkProgram(program);
    	gl.useProgram(program);
		return program;
	}
}

function CellsShaderBuilder(gl) {
	return BuildShader(gl, cellsVertexShaderCode, cellsFragmentShaderCode);
}

function LineProgramShaderBuilder(gl) {
	return BuildShader(gl, linesVertexShaderCode, linesFragmentShaderCode);
}

function BuildIndicesForPoly(vertexOffset) {
	return [
		vertexOffset,
		vertexOffset + 1,
		vertexOffset + 2,
		vertexOffset + 2,
		vertexOffset + 3,
		vertexOffset
	];
}

function BuildLinePolygon(dot, isHorizontal, owner, bufferLists) {
	const { x, y } = dot;
	const thickness = 0.05;

	let vertices = null;
	const vertexOffset = bufferLists.vertices.length / 2; // Remember, 2 floats per vertex

	if (isHorizontal) {
		const yTop = y - thickness;
		const yBot = y + thickness;	
		vertices = [
			x, yTop,     // Top left
			x + 1, yTop, // Top right
			x + 1, yBot, // Bottom right
			x, yBot		 // Bottom left
		];
	} else {
		const xLeft = x - thickness;
		const xRight = x + thickness;
		vertices = [
            xLeft, y,		// Top left
            xRight, y,		// Top right
            xRight, y + 1, 	// Bottom right
            xLeft, y + 1, 	// Bottom left
		];
	}	
	const vertexIndices = BuildIndicesForPoly(vertexOffset); 

	vertices.forEach(vert => bufferLists.vertices.push(vert)); 
	vertexIndices.forEach(index => bufferLists.vertexIndices.push(index)); 

	const col = owner === Ownership.PLAYER1 ? Colours.PLAYER1 : Colours.PLAYER2;
	for (let i=0; i<4; i++) {
		col.forEach(c => bufferLists.colours.push(c));
	}
}

function BuildCellPolygon(square, bufferLists) {
	const { ownership } = square;
	const space = 2.0 / 10.0; // replace 10 with num dots
	const half= space * 0.5;
	const x = square.x * space + space -1.0;
	const y = -1.0* (square.y * space + space -1.0); // Flip to match lines

	const vertices = [
		x - half, y - half, // Top left
		x + half, y - half, // Top right
		x + half, y + half,	// Bottom right 
		x - half, y + half 	// Bottom left
	];
	const vertexOffset = bufferLists.vertices.length / 2;
	const vertexIndices = BuildIndicesForPoly(vertexOffset); 

	vertices.forEach(vert => bufferLists.vertices.push(vert)); 
	vertexIndices.forEach(index => bufferLists.vertexIndices.push(index)); 

	let col = Colours.BOARDGREY;
	if (ownership === Ownership.PLAYER1) {
		col = Colours.PLAYER1;
	} else if (ownership === Ownership.PLAYER2) {
		col = Colours.PLAYER2;
	}
	for (let i=0; i<4; i++) {
		col.forEach(c => bufferLists.colours.push(c));
	}
}

function BuildBufferLists() {
	return {
		vertices: [],
		vertexIndices: [],
		colours: []
	};
}

function BuildBuffersFromLists(gl, bufferLists) {
	const buffers = {
		vertexBuffer: gl.createBuffer(),
		vertexIndexBuffer: gl.createBuffer(),
		colourBuffer: gl.createBuffer()
	};

	// Build vertex buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array(bufferLists.vertices),
		gl.STATIC_DRAW
	);

	// Build colour buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colourBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array(bufferLists.colours),
		gl.STATIC_DRAW
	);

	// Build vertex index buffer
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.vertexIndexBuffer);
	gl.bufferData(
		gl.ELEMENT_ARRAY_BUFFER,
		new Uint16Array(bufferLists.vertexIndices),
		gl.STATIC_DRAW
	);

	return buffers;
}

function DrawCells(gl, boardSize, squares) {
	// Clear canvas 
	gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

	// Build buffers
	const bufferLists = BuildBufferLists();
	squares.forEach(square => BuildCellPolygon(square, bufferLists)); 
	const buffers = BuildBuffersFromLists(gl, bufferLists);

	// Draw cells
	const program = UseShaders(gl, 'Cells', CellsShaderBuilder);
	const glVertCount = bufferLists.vertexIndices.length;
	console.log("Drawing squares verts", glVertCount, squares.length);
	DrawUsingBuffersAndCleanup(gl, buffers, program, glVertCount);
}

function DrawLines(gl, dots=[]) {
	// Build buffers
	const bufferLists = BuildBufferLists();
	dots.forEach(dot => {
		if (dot.horizontalLine && dot.horizontalLine != Ownership.NONE) {
			BuildLinePolygon(dot, true, dot.horizontalLine, bufferLists); 
		}
		if (dot.verticalLine && dot.verticalLine != Ownership.NONE) {
			BuildLinePolygon(dot, false, dot.verticalLine, bufferLists); 
		}
	});
	const buffers = BuildBuffersFromLists(gl, bufferLists);

	// Draw lines
	const program = UseShaders(gl, 'Lines', LineProgramShaderBuilder);
	const glVertCount = bufferLists.vertexIndices.length;
	DrawUsingBuffersAndCleanup(gl, buffers, program, glVertCount);
}

function DrawUsingBuffersAndCleanup(gl, buffers, program, glVertCount) {
	const {
		vertexBuffer,
		vertexIndexBuffer,
		colourBuffer,
	} = buffers;

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, colourBuffer);
    const colour = gl.getAttribLocation(program, "a_colour");
    gl.enableVertexAttribArray(colour);
    gl.vertexAttribPointer(colour, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
	gl.drawElements(gl.TRIANGLES, glVertCount, gl.UNSIGNED_SHORT, vertexIndexBuffer);

	gl.disableVertexAttribArray(position);
	gl.disableVertexAttribArray(colour);
	gl.deleteBuffer(vertexBuffer);
	gl.deleteBuffer(colourBuffer);
	gl.deleteBuffer(vertexIndexBuffer);
}

export function RenderGame(canvas, state) {
	const size = state.boardSize;
	const dots = state.boardState.points;
	const squares = state.boardState.squares;

	const gl = canvas.getContext('webgl');
	if (!gl) {
		alert('Failed to initialise WebGL!');
		return;
	}
	DrawCells(gl, size, squares.flat());
	DrawLines(gl, dots.flat());
}

function genFakeData(count) {
	const data = [];
	const owner1 = Math.random() > 0.5 ? 1 : 2;
	const owner2 = Math.random() > 0.5 ? 1 : 2;
	for (let i=0; i<count; i++) {
		data.push({
			x: Math.round(Math.random() * 9),
			y: Math.round(Math.random() * 9),
			horizontalLine: Math.random() > 0.5 ? owner1 : null,
			verticalLine: Math.random() > 0.5 ? owner2 : null,
		});
	}
	return data;
}

function genTestData() {
	return [
		{
			x: 0,
			y: 0,
			horizontalLine: Ownership.PLAYER1,
			verticalLine: Ownership.PLAYER2,
		},
		{
			x: 8,
			y: 8,
			horizontalLine: Ownership.PLAYER1,
			verticalLine: Ownership.PLAYER2,
		},
		{
			x: 9,
			y: 8,
			horizontalLine: null,
			verticalLine: Ownership.PLAYER2,
		},
		{
			x: 8,
			y: 9,
			horizontalLine: Ownership.PLAYER1,
			verticalLine: null,
		},
	];
}