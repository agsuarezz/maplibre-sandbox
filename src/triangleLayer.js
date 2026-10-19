import * as maplibregl from 'maplibre-gl';

export function createTriangleLayer(id, lngLat, altitude = 150) {
  let modelMatrix = null;
  let mapRef = null;

  return {
    id: id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      mapRef = map;

      const modelOrigin = maplibregl.MercatorCoordinate.fromLngLat(lngLat, altitude);
      const modelScale = modelOrigin.meterInMercatorCoordinateUnits();

      // Matriz de modelo: escala en metros y posición Mercator
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
        void main() {
          gl_Position = u_matrix * u_modelMatrix * vec4(a_pos, 1.0);
        }
      `;

      const fragmentSource = `
        precision mediump float;
        void main() {
          gl_FragColor = vec4(0.0, 0.9, 1.0, 1.0); // Cian sólido
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

      // Vértices locales en metros (triángulo de 80 metros)
      const r = 40;
      const vertices = new Float32Array([
        0, -r, 0,
        -r, r, 0,
        r, r, 0
      ]);

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

      // --- AJUSTES CRÍTICOS PARA EVITAR QUE DESAPAREZCA ---
      // 1. Forzar que siempre se dibuje por encima del terreno si hay conflicto
      gl.disable(gl.DEPTH_TEST); 
      gl.depthMask(false);

      // 2. Desactivar descarte de caras
      gl.disable(gl.CULL_FACE);

      // 3. Dibujar
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 4. Restaurar estado de WebGL para MapLibre
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disableVertexAttribArray(this.aPos);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      // Forzar que el canvas se actualice continuamente mientras la cámara se mueve
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