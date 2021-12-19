import { Ownership } from '../shared/gamestate'

const Colours = {
	ALPHA: [0.0, 1.0, 0.0, 1.0],
	BLACK: [0.0, 0.0, 0.0, 1.0],
	PLAYER1: [1.0, 0.0, 0.0, 1.0],
	PLAYER2: [0.0, 0.0, 1.0, 1.0],
};

const vertexShaderContent = "\
    attribute vec2 a_position;\
    void main() {\
        gl_Position = vec4(a_position.xy, 0, 1);\
    }\
";

const fragmentDotsAndCells = "\
	precision mediump float;\
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
			gl_FragColor = vec4(0.97, 0.97, 0.97, 1.0);\
		}\
    }\
";

// @TODO - refactor shaders to handle any grid size. Currently locked to 10 dots
const linesVertexShaderCode = "\
    attribute vec2 a_position;\
    attribute vec4 a_colour;\
	varying vec4 col;\
    void main() {\
		col = a_colour;\
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
 * gl - The open gl context, we want to cache compiled shader programs here for performance
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

function DotsAndCellsShaderBuilder(gl) {
    // Compile and attach shaders
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vertexShaderContent);
    gl.compileShader(vShader);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fShader, fragmentDotsAndCells);
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


function LineProgramShaderBuilder(gl) {
    // Compile and attach shaders
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, linesVertexShaderCode);
    gl.compileShader(vShader);
	var error_log = gl.getShaderInfoLog(vShader);
	console.log(error_log);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fShader, linesFragmentShaderCode);
    gl.compileShader(fShader);
	var error_log2 = gl.getShaderInfoLog(fShader);
	console.log(error_log2);

	return () => {
		const program = gl.createProgram();
		gl.attachShader(program, vShader);
		gl.attachShader(program, fShader);
		gl.linkProgram(program);
    	gl.useProgram(program);
		return program;
	}
}

function BuildLinePolygon(dot, isHorizontal, owner, bufferLists) {
	const { x, y } = dot;
	const thickness = 0.05;

	let vertices = null;
	let vertexOffset = bufferLists.vertices.length / 2; // Remember, 2 floats per vertex

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
	const vertexIndices = [
		vertexOffset,
		vertexOffset + 1,
		vertexOffset + 2,
		vertexOffset + 2,
		vertexOffset + 3,
		vertexOffset
	];

	vertices.forEach(vert => bufferLists.vertices.push(vert)); 
	vertexIndices.forEach(index => bufferLists.vertexIndices.push(index)); 

	const col = owner === Ownership.PLAYER1 ? Colours.PLAYER1 : Colours.PLAYER2;
	for (let i=0; i<4; i++) {
		col.forEach(c => bufferLists.colours.push(c));
	}
}

// Will build new buffers
function RebuildLineBuffers(gl, dots) {
	const buffers = {
		lineVertexBuffer: gl.createBuffer(),
		lineVertexIndexBuffer: gl.createBuffer(),
		lineColourBuffer: gl.createBuffer(),
	};

	const bufferLists = {
		vertices: [],
		vertexIndices: [],
		colours: [],
	};

	// Build buffer lists for all the lines
	dots.forEach(dot => {
		if (dot.horizontalLine && dot.horizontalLine != Ownership.NONE) {
			BuildLinePolygon(dot, true, dot.horizontalLine, bufferLists); 
		}
		if (dot.verticalLine && dot.verticalLine != Ownership.NONE) {
			BuildLinePolygon(dot, false, dot.verticalLine, bufferLists); 
		}
	});

	// Build vertex buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.lineVertexBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array(bufferLists.vertices),
		gl.STATIC_DRAW
	);

	// Build colour buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.lineColourBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array(bufferLists.colours),
		gl.STATIC_DRAW
	);

	// Build vertex index buffer
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.lineVertexIndexBuffer);
	gl.bufferData(
		gl.ELEMENT_ARRAY_BUFFER,
		new Uint16Array(bufferLists.vertexIndices),
		gl.STATIC_DRAW
	);

	return { buffers, glVertCount: bufferLists.vertexIndices.length };
}

// This is the cross and cell shader
function CellShader(gl, size) {
	gl.clearColor(0.5, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create mesh
    const bufferMesh = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferMesh);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            -1.0, 1.0,
            1.0, -1.0,
            1.0, 1.0,
        ]),
        gl.STATIC_DRAW
    );

	const program = UseShaders(gl, 'Dots_And_Cells', DotsAndCellsShaderBuilder);
    gl.useProgram(program);

    // Pass values to shaders
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	return 6;
}

function DrawLines(gl, dots=[]) {
	const { buffers, glVertCount } = RebuildLineBuffers(gl, dots);
	const {
		lineVertexBuffer,
		lineVertexIndexBuffer,
		lineColourBuffer,
	} = buffers;

	const program = UseShaders(gl, 'Lines', LineProgramShaderBuilder);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineVertexBuffer);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, lineColourBuffer);
    const colour = gl.getAttribLocation(program, "a_colour");
    gl.enableVertexAttribArray(colour);
    gl.vertexAttribPointer(colour, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineVertexIndexBuffer);
	console.log("GL VERT COUNT: ", glVertCount);
	gl.drawElements(gl.TRIANGLES, glVertCount, gl.UNSIGNED_SHORT, lineVertexIndexBuffer);

	gl.disableVertexAttribArray(position);
	gl.disableVertexAttribArray(colour);
	gl.deleteBuffer(lineVertexBuffer);
	gl.deleteBuffer(lineColourBuffer);
	gl.deleteBuffer(lineVertexIndexBuffer);
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
	const vCellCount = CellShader(gl, size);
	gl.drawArrays(gl.TRIANGLES, 0, vCellCount);
	// DrawLines(gl, genTestData() /*dots.flat()*/);
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