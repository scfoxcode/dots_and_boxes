// Very nasty copy pasta from game state
const Ownership = Object.freeze({
	NONE: 'NONE',
	PLAYER: 'PLAYER',
	PLAYER1: 'PLAYER1',
	PLAYER2: 'PLAYER2',
	OBSERVER: 'OBSERVER'
});
// We need to refactor the observer to be a proper module and build the result. Sad times

const vertexShaderContent = "\
    attribute vec2 a_position;\
    void main() {\
        gl_Position = vec4(a_position.xy, 0, 1);\
    }\
";

// @TODO - refactor shaders to handle any grid size. Currently locked to 10 dots
const vertexShaderContent2 = "\
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

const fragmentLines = "\
	precision mediump float;\
	varying vec4 col;\
	void main() {\
		gl_FragColor = col;\
	}\
";

function DotCellProgram (gl) {
    // Compile and attach shaders
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vertexShaderContent);
    gl.compileShader(vShader);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fShader, fragmentDotsAndCells);
    gl.compileShader(fShader);
	var error_log = gl.getShaderInfoLog(fShader);
	console.log(error_log);

    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
	
	return program;
}


function LineProgram (gl) {
    // Compile and attach shaders
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vertexShaderContent2);
    gl.compileShader(vShader);
	var error_log = gl.getShaderInfoLog(vShader);
	console.log(error_log);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fShader, fragmentLines);
    gl.compileShader(fShader);
	var error_log2 = gl.getShaderInfoLog(fShader);
	console.log(error_log2);

    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
	
	return program;
}


// This is so lazy, not using index buffer. Massive duplication on the colours
function BuildLinePoly (x, y, isHorizontal, owner, lines, colours) {
	let verts = null;

	const thickness = 0.05;
	if (isHorizontal) {
		const yTop = y - thickness;
		const yBot = y + thickness;	
		verts = [
            x, yTop,
            x + 1, yTop,
            x + 1, yBot,
            x + 1, yBot,
            x, yBot,
            x, yTop,
		]
	} else {
		const xLeft = x - thickness;
		const xRight = x + thickness;
		verts = [
            xLeft, y,
            xRight, y,
            xRight, y + 1,
            xRight, y + 1,
            xLeft, y + 1,
            xLeft, y,
		]
	}	
	verts.forEach(vert => lines.push(vert)); 

	// This is so so bad
	// Push each channel for each of the 6 verts...
	for (let i=0; i<6; i++) {
		const col = owner === 1 ? [1.0, 0.0, 0.0, 1.0] : [0.0, 0.0, 1.0, 1.0];
		col.forEach(c => colours.push(c));
	}

}

// Will build new buffers
function RebuildLineBuffers (gl, dots) {
	const lineVertexBuffer = gl.createBuffer();
	const lineColourBuffer = gl.createBuffer();

	const lines = [];
	const colours = [];
	dots.forEach(dot => {
		if (dot.horizontalLine && dot.horizontalLine != Ownership.NONE) {
			BuildLinePoly(dot.x, dot.y, true, dot.horizontalLine, lines, colours);
		}
		if (dot.verticalLine && dot.verticalLine != Ownership.NONE) {
			BuildLinePoly(dot.x, dot.y, false, dot.verticalLine, lines, colours);
		}
	});

	gl.bindBuffer(gl.ARRAY_BUFFER, lineVertexBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array(lines),
		gl.DYNAMIC_DRAW
	);

	gl.bindBuffer(gl.ARRAY_BUFFER, lineColourBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array(colours),
		gl.DYNAMIC_DRAW
	);
	return { lineVertexBuffer, lineColourBuffer, linesLength: lines.length, coloursLength: colours.length };
}

// This is the cross and cell shader
function CellShader(gl) {
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
        gl.DYNAMIC_DRAW
    );

	// We should only ever call this function once!!! TODO ensure this
	const program = DotCellProgram(gl);
    gl.useProgram(program);

    // Pass values to shaders
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	return 6;
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
			horizontalLine: 1,
			verticalLine: 2,
		},
		{
			x: 8,
			y: 8,
			horizontalLine: 1,
			verticalLine: 2,
		},
		{
			x: 9,
			y: 8,
			horizontalLine: null,
			verticalLine: 2,
		},
		{
			x: 8,
			y: 9,
			horizontalLine: 1,
			verticalLine: null,
		},
	];
}

// Initialise the line shader
function LineShader (gl) {
	const { lineVertexBuffer, lineColourBuffer,
			linesLength, coloursLength
		} = RebuildLineBuffers(gl, genTestData(50));

	// We should only ever call this function once!!! TODO ensure this
	const program = LineProgram(gl);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineVertexBuffer);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);


    gl.bindBuffer(gl.ARRAY_BUFFER, lineColourBuffer);
    const colour = gl.getAttribLocation(program, "a_colour");
    gl.enableVertexAttribArray(colour);
    gl.vertexAttribPointer(colour, 4, gl.FLOAT, false, 0, 0);
	console.log("vColourCount", coloursLength / 4);
	return linesLength / 2;
}


export function HackyDraw(canvas) {
	const gl = canvas.getContext('webgl');
	if (!gl) {
		alert('Failed to initialise WebGL!');
		return;
	}
	const vCellCount = CellShader(gl);
	gl.drawArrays(gl.TRIANGLES, 0, vCellCount);
	const vLineCount = LineShader(gl);
	console.log("vLineCount", vLineCount);
	gl.drawArrays(gl.TRIANGLES, 0, vLineCount);
}