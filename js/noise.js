// Simplex noise implementation for procedural biome generation
// Based on Stefan Gustavson's implementation

class SimplexNoise {
  constructor(seed) {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.perm = new Array(512);
    this.gradP = new Array(512);
    this.seed(seed || Math.random() * 65536);
  }

  seed(seed) {
    seed = Math.floor(seed);
    if (seed < 256) seed |= seed << 8;
    const p = new Array(256);
    for (let i = 0; i < 256; i++) {
      let v;
      if (i & 1) {
        v = this._hash(i, seed) & 255;
      } else {
        v = this._hash(seed, i) & 255;
      }
      p[i] = v;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.gradP[i] = this.grad3[this.perm[i] % 12];
    }
  }

  _hash(a, b) {
    a = ((a >> 16) ^ a) * 0x45d9f3b;
    a = ((a >> 16) ^ a) * 0x45d9f3b;
    a = (a >> 16) ^ a;
    return (a ^ b) & 0xffffffff;
  }

  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    let s = (x + y) * F2;
    let i = Math.floor(x + s);
    let j = Math.floor(y + s);
    let t = (i + j) * G2;

    let X0 = i - t;
    let Y0 = j - t;
    let x0 = x - X0;
    let y0 = y - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    let x1 = x0 - i1 + G2;
    let y1 = y0 - j1 + G2;
    let x2 = x0 - 1 + 2 * G2;
    let y2 = y0 - 1 + 2 * G2;

    i &= 255;
    j &= 255;

    let gi0 = this.gradP[i + this.perm[j]];
    let gi1 = this.gradP[i + i1 + this.perm[j + j1]];
    let gi2 = this.gradP[i + 1 + this.perm[j + 1]];

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (gi0[0] * x0 + gi0[1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (gi1[0] * x1 + gi1[1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (gi2[0] * x2 + gi2[1] * y2);
    }

    return 70 * (n0 + n1 + n2);
  }

  // Multi-octave noise for more natural patterns
  fbm(x, y, octaves = 4, lacunarity = 2.0, persistence = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }
}
