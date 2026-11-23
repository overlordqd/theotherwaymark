import * as THREE from 'three';

/**
 * The look: the scene is drawn into a small render target (about 260 rows high),
 * then stretched to the screen with nearest-neighbour sampling, a light ordered
 * dither and a vignette. That is what makes it pixelated.
 */
export function makeRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(1);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1600);
  const rt = new THREE.WebGLRenderTarget(320, 180, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const post = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, res: { value: new THREE.Vector2(320, 180) }, vig: { value: 0.9 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 res; uniform float vig; varying vec2 vUv;
      float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float b4(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float d = b4(floor(vUv * res)) - 0.5;
        c = floor(c * 22.0 + 0.5 + d) / 22.0;
        vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * vig;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let baseFov = 55;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const px = Math.max(2, Math.round(h / 260));
    const rw = Math.ceil(w / px), rh = Math.ceil(h / px);
    rt.setSize(rw, rh); post.uniforms.res.value.set(rw, rh);
    baseFov = w < h ? 70 : 55;
    camera.aspect = w / h; camera.fov = baseFov; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function render(scene: THREE.Scene) {
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  return { renderer, camera, post, render, resize, get baseFov() { return baseFov; } };
}
export type Renderer = ReturnType<typeof makeRenderer>;
