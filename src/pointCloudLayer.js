import * as maplibregl from 'maplibre-gl';

// multiplica dos mat4 column-major en doble precisión
function mul(a, b) {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
            for (let k = 0; k < 4; k++)
                o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
}

export function createPointCloudLayer(id, lngLat, altitude = 100) {
    const NUM_POINTS = 50000;
    const RADIO = 600;
    let modelMatrix, modelOrigin, modelScale;

    return {
        id,
        type: 'custom',
        renderingMode: '3d',
        count: 0,

        onAdd(map, gl) {
            this.map = map;

            modelOrigin = maplibregl.MercatorCoordinate.fromLngLat(lngLat, 0);
            modelScale = modelOrigin.meterInMercatorCoordinateUnits();

            modelMatrix = [
                modelScale, 0, 0, 0,
                0, -modelScale, 0, 0,   // Y invertido: +y = norte
                0, 0, modelScale, 0,
                modelOrigin.x, modelOrigin.y, modelOrigin.z, 1
            ];

            const vs = `
                uniform mat4 u_matrix;
                attribute vec3 a_pos;
                varying float v_height;
                void main() {
                    gl_Position = u_matrix * vec4(a_pos, 1.0);
                    gl_PointSize = 4.0;
                    v_height = a_pos.z;
                }`;

            const fs = `
                precision mediump float;
                varying float v_height;
                void main() {
                    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                    if (dot(cxy, cxy) > 1.0) discard;
                    // ajusta el rango a la elevación real de tu zona
                    float t = clamp((v_height - 500.0) / 400.0, 0.0, 1.0);
                    vec3 c = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.2, 0.5), t);
                    gl_FragColor = vec4(c, 0.85);
                }`;

            const compile = (type, src) => {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                    console.error(gl.getShaderInfoLog(s));
                return s;
            };

            this.program = gl.createProgram();
            gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vs));
            gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fs));
            gl.linkProgram(this.program);
            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
                console.error(gl.getProgramInfoLog(this.program));

            this.aPos = gl.getAttribLocation(this.program, 'a_pos');
            this.uMatrix = gl.getUniformLocation(this.program, 'u_matrix');
            this.buffer = gl.createBuffer();

            const build = () => {
                const vertices = new Float32Array(NUM_POINTS * 3);
                for (let i = 0; i < NUM_POINTS; i++) {
                    const x = (Math.random() * 2 - 1) * RADIO; // este (m)
                    const y = (Math.random() * 2 - 1) * RADIO; // norte (m)

                    // misma convención que la matriz: +y = norte = Mercator y decreciente
                    const p = new maplibregl.MercatorCoordinate(
                        modelOrigin.x + x * modelScale,
                        modelOrigin.y - y * modelScale,
                        0
                    ).toLngLat();

                    const elev = map.queryTerrainElevation([p.lng, p.lat]);
                    vertices[i * 3]     = x;
                    vertices[i * 3 + 1] = y;
                    vertices[i * 3 + 2] = (elev ?? 0) + 2;
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
                gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
                this.count = NUM_POINTS;
                map.triggerRepaint();
            };

            // 1) dibuja ya (con lo que haya), 2) recalcula cuando el terreno esté cargado
            build();
            map.once('idle', build);
            map.triggerRepaint(); // asegura que se emita 'idle'
        },

        render(gl, args) {
            if (!this.count) return;

            const cam = args?.defaultProjectionData?.mainMatrix ?? args;
            gl.useProgram(this.program);
            gl.uniformMatrix4fv(this.uMatrix, false, mul(Array.from(cam), modelMatrix));

            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.enableVertexAttribArray(this.aPos);
            gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            gl.drawArrays(gl.POINTS, 0, this.count);

            gl.disableVertexAttribArray(this.aPos);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.enable(gl.DEPTH_TEST);
        },

        onRemove(map, gl) {
            gl.deleteBuffer(this.buffer);
            gl.deleteProgram(this.program);
        }
    };
}