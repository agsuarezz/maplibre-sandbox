import * as maplibregl from 'maplibre-gl';

export function createPointCloudLayer(id, lngLat, altitude=100) {
    let modelMatrix = null;
    let mapRef = null;
    const NUM_POINTS = 50000;

    return {
        id: id,
        type: 'custom',
        renderingMode: '3d',

        onAdd(map, gl) {
            mapRef = map;

            const modelOrigin = maplibregl.MercatorCoordinate.fromLngLat(lngLat, altitude);
            const modelScale = modelOrigin.meterInMercatorCoordinateUnits();

            modelMatrix = [
                modelScale, 0, 0, 0,
                0, -modelScale, 0, 0,
                0, 0, modelScale, 0,
                modelOrigin.x, modelOrigin.y, modelOrigin.z, 1
            ];

             const vertexSource = `
                uniform mat4 u_matrix;
                uniform mat4 u_modelMatrix;
                attribute vec3 a_pos;
                varying float v_height;

                void main() {
                gl_Position = u_matrix * u_modelMatrix * vec4(a_pos, 1.0);
                gl_PointSize = 3.0; // Tamaño del punto en píxeles de pantalla
                v_height = a_pos.z; // Pasamos la Z local para colorear según altura
                }
            `;

            const fragmentSource = `
                precision mediump float;
                varying float v_height;

                void main() {
                // Convierte el punto cuadrado por defecto de WebGL en un círculo suave
                vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                if (dot(cxy, cxy) > 1.0) {
                    discard;
                }

                // Normalizamos la altura (que va de -30m a +30m) entre 0.0 y 1.0
                float t = clamp((v_height + 30.0) / 60.0, 0.0, 1.0);

                // Mezcla entre Cian (bajo) y Magenta/Naranja (alto)
                vec3 colorBajo = vec3(0.0, 0.9, 1.0);
                vec3 colorAlto = vec3(1.0, 0.2, 0.5);
                vec3 colorFinal = mix(colorBajo, colorAlto, t);

                gl_FragColor = vec4(colorFinal, 0.85);
                }
            `;

            const compileShader = (type, source) => {
                const shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(shader));
                }
                return shader;
            };

            const vertShader = compileShader(gl.VERTEX_SHADER, vertexSource);
            const fragShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

            this.program = gl.createProgram();
            gl.attachShader(this.program, vertShader);
            gl.attachShader(this.program, fragShader);
            gl.linkProgram(this.program);

            this.aPos = gl.getAttribLocation(this.program, 'a_pos');
            this.uMatrix = gl.getUniformLocation(this.program, 'u_matrix');
            this.uModelMatrix = gl.getUniformLocation(this.program, 'u_modelMatrix');

            const vertices = new Float32Array(NUM_POINTS * 3);
            const radioArea = 150; // 150m a cada lado

            for (let i = 0; i < NUM_POINTS; i++) {
                const x = (Math.random() * 2 - 1) * radioArea;
                const y = (Math.random() * 2 - 1) * radioArea;

                // Generamos una onda senoidal en Z + un poco de grosor aleatorio
                const z = (Math.random() * 2 - 1) * 30;

                const idx = i * 3;
                vertices[idx] = x;
                vertices[idx + 1] = y;
                vertices[idx + 2] = z;
            }

            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        },

        render(gl, matrix) {
            gl.useProgram(this.program);

            const camMatrix = matrix?.defaultProjectionData?.mainMatrix || matrix;

            gl.uniformMatrix4fv(this.uMatrix, false, camMatrix);
            gl.uniformMatrix4fv(this.uModelMatrix, false, modelMatrix);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.enableVertexAttribArray(this.aPos);
            gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);

            gl.disable(gl.DEPTH_TEST);
            gl.depthMask(false);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            gl.drawArrays(gl.POINTS, 0, NUM_POINTS);

            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            gl.disableVertexAttribArray(this.aPos);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            if (mapRef) {
                mapRef.triggerRepaint();
            }
        },

        onRemove(gl) {
            gl.deleteBuffer(this.buffer);
            gl.deleteProgram(this.program);
        }
    };
}