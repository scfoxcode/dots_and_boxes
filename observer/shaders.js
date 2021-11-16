const vertexShaderContent = "\
    attribute vec2 a_position;\
    void main() {\
        gl_Position = vec4(a_position, 0, 1);\
    }\
";

const fragmentShaderContent = "\
    void main() {\
        gl_FragColor = vec4(gl_FragCoord.x / 640.0, gl_FragCoord.y / 480.0, 0.0, 1.0);\
    }\
";

const fragmentShaderContent2 = "\
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
			gl_FragColor = vec4(0.8, 0.8, 0.8, 1.0);\
		} else {\
			gl_FragColor = vec4(0.98, 0.98, 1.0, 1.0);\
		}\
    }\
";

function InitialiseShaders (canvas) {
	const gl = canvas.getContext('webgl');
	if (!gl) {
		alert('Failed to initialise WebGL!');
		return;
	}
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

    // Compile and attach shaders
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vertexShaderContent);
    gl.compileShader(vShader);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fShader, fragmentShaderContent2);
    gl.compileShader(fShader);
	var error_log = gl.getShaderInfoLog(fShader);
	console.log(error_log);

    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Pass values to shaders
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
}