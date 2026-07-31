// Clock 
(function () {
  var el = document.getElementById('clock');
  if (!el) return;
  var fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  function tick(){ el.textContent = fmt.format(new Date()); }
  tick();
  setInterval(tick, 1000);
})();

// Scroll Percentage
(function () {
  var el = document.getElementById('prog');
  if (!el) return;
  var ticking = false;
  function update(){
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
    el.textContent = Math.min(100, Math.max(0, pct));
    ticking = false;
  }
  window.addEventListener('scroll', function(){
    if (!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive:true });
  window.addEventListener('resize', update);
  update();
})();

// Moving Star with particles
(function () {
  var canvas = document.getElementById('star');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Modifier
  var COUNT      = window.innerWidth < 7600 ? 18000 : 32000;  
  var RIM_SHARE  = 0.26;  
  var DEPTH      = 0.22;  
  var SWIRL      = 0.54;  
  var BREATH     = 0.10;  
  var SPEED_IDLE = 1.30;  
  var SPEED_MAX  = 25.5;   
  var REACH      = 460;   
  var TILT       = 0.26;  
  var FOV        = 3.2;   
  var SHINE      = 34;    
  var GRAIN      = 0.046; 
  var CLEAR      = 0.12;  
  var DENSE      = 0.90;  
  var FRESNEL    = 2.4;   

  var TAU = Math.PI * 2;

  // Spikes & Radius
  var SPIKES = 5, R_OUT = 1, R_IN = 0.42;
  var poly = [];
  for (var i = 0; i < SPIKES * 2; i++) {
    var r = (i % 2 === 0) ? R_OUT : R_IN;
    var a = -Math.PI / 2 + i * Math.PI / SPIKES;
    poly.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  // Ray
  function radiusAt(theta) {
    var dx = Math.cos(theta), dy = Math.sin(theta);
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var ax = poly[j][0], ay = poly[j][1];
      var ex = poly[i][0] - ax, ey = poly[i][1] - ay;
      var det = ex * dy - dx * ey;
      if (Math.abs(det) < 1e-9) continue;
      var t = (ex * ay - ax * ey) / det;      
      var s = (dx * ay - dy * ax) / det;      
      if (t > 0 && s >= 0 && s <= 1) return t;
    }
    return R_IN;
  }

  var LUTN = 1024, RLUT = new Float32Array(LUTN + 1);
  for (var t0 = 0; t0 < LUTN; t0++) RLUT[t0] = radiusAt(t0 / LUTN * TAU);
  RLUT[LUTN] = RLUT[0];

  function radiusLookup(theta) {
    var t = theta % TAU;
    if (t < 0) t += TAU;
    var f = t / TAU * LUTN;
    var i0 = f | 0;
    var fr = f - i0;
    return RLUT[i0] + (RLUT[i0 + 1] - RLUT[i0]) * fr;
  }

  // Particles
  var pts = [];
  var rimCount = Math.round(COUNT * RIM_SHARE);

  for (var n0 = 0; n0 < COUNT; n0++) {
    var isRim = n0 < rimCount;
    var u0 = isRim ? 1 : Math.sqrt(Math.random());   
    pts.push({
      th: Math.random() * TAU,
      u0: u0,
      side: Math.random() < 0.5 ? 1 : -1,
      rim: isRim,
      w: SWIRL * (0.35 + 0.9 * (1 - u0)) * (0.75 + 0.5 * Math.random()),
      amp: isRim ? 0 : BREATH * Math.random(),
      ph: Math.random() * TAU,
      fr: 0.3 + Math.random() * 0.7,
      s: isRim ? 0.45 + Math.random() * 0.6 : 0.35 + Math.random() * 0.55,
      x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0
    });
  }

  //Particles as Sprites
  var LEVELS = 14, ALPHAS = 7, SPRITE = 40, sprites = [], flare;
  var RAMP = [
    [0.00, [ 12,  26,  40]],   
    [0.24, [ 27,  62, 108]],   
    [0.44, [ 46, 125, 196]],   
    [0.60, [111, 180, 232]],   
    [0.72, [244, 220, 172]],   
    [0.86, [206, 233, 249]],   
    [1.00, [255, 255, 255]]
  ];

  function rampColor(b) {
    for (var i = 1; i < RAMP.length; i++) {
      if (b <= RAMP[i][0]) {
        var a0 = RAMP[i - 1], a1 = RAMP[i];
        var f = (b - a0[0]) / (a1[0] - a0[0]);
        return [
          a0[1][0] + (a1[1][0] - a0[1][0]) * f,
          a0[1][1] + (a1[1][1] - a0[1][1]) * f,
          a0[1][2] + (a1[1][2] - a0[1][2]) * f
        ];
      }
    }
    return RAMP[RAMP.length - 1][1];
  }

  function shade(col, m, alpha) {
    return 'rgba(' +
      Math.max(0, Math.min(255, Math.round(col[0] * m))) + ',' +
      Math.max(0, Math.min(255, Math.round(col[1] * m))) + ',' +
      Math.max(0, Math.min(255, Math.round(col[2] * m))) + ',' +
      Math.max(0, Math.min(1, alpha)).toFixed(3) + ')';
  }

  // Shading
  function bucketAlpha(ai) { return CLEAR + (DENSE - CLEAR) * (ai / (ALPHAS - 1)); }

  for (var l = 0; l < LEVELS; l++) {
    var b = l / (LEVELS - 1);
    var base = rampColor(b);
    for (var ai = 0; ai < ALPHAS; ai++) {
      var A = bucketAlpha(ai);
      var c = document.createElement('canvas');
      c.width = c.height = SPRITE;
      var g = c.getContext('2d');
      var grd = g.createRadialGradient(
        SPRITE * 0.36, SPRITE * 0.30, SPRITE * 0.02,
        SPRITE * 0.50, SPRITE * 0.50, SPRITE * 0.50
      );
      grd.addColorStop(0.00, 'rgba(255,255,255,' + (A * (0.35 + 0.5 * b)).toFixed(3) + ')');
      grd.addColorStop(0.34, shade(base, 1.30, A * 0.42));
      grd.addColorStop(0.66, shade(base, 1.00, A * 0.30));
      grd.addColorStop(0.88, shade(base, 1.15, A));          // dichter Rand: der Glasrand
      grd.addColorStop(1.00, shade(base, 0.80, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, SPRITE, SPRITE);
      sprites.push(c);
    }
  }

  // Flare
  flare = document.createElement('canvas');
  flare.width = flare.height = 26;
  var fg = flare.getContext('2d');
  var fgr = fg.createRadialGradient(13, 13, 0, 13, 13, 13);
  fgr.addColorStop(0.00, 'rgba(255,255,255,.95)');
  fgr.addColorStop(0.28, 'rgba(255,225,150,.50)');
  fgr.addColorStop(1.00, 'rgba(255,211,107,0)');
  fg.fillStyle = fgr;
  fg.fillRect(0, 0, 26, 26);

  //Light
  var LX = 0.46, LY = -0.70, LZ = -0.55;
  var ll = Math.sqrt(LX * LX + LY * LY + LZ * LZ);
  LX /= ll; LY /= ll; LZ /= ll;
  var HX = LX, HY = LY, HZ = LZ - 1;
  var hl = Math.sqrt(HX * HX + HY * HY + HZ * HZ);
  HX /= hl; HY /= hl; HZ /= hl;

  // State and Size
  var W = 0, H = 0, dpr = 1;
  var rot = 0.7, speed = SPEED_IDLE, target = SPEED_IDLE;
  var clock = 0;
  var mouseX = null, mouseY = null;
  var running = false, last = 0;

  var buf = new Array(pts.length);
  for (var q = 0; q < pts.length; q++) {
    buf[q] = { sx: 0, sy: 0, k: 1, z: 0, s: 1, img: null, spec: 0 };
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    draw();
  }

  // Moving Particles
  function advance(dt, flow) {
    clock += dt * flow;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.th += p.w * dt * flow;

      var u = p.u0 + p.amp * Math.sin(p.ph + clock * p.fr);
      if (u < 0.04) u = 0.04; else if (u > 1) u = 1;

      var R = radiusLookup(p.th);
      var cth = Math.cos(p.th), sth = Math.sin(p.th);
      p.x = cth * u * R;
      p.y = sth * u * R;

      if (p.rim) {
        p.z = 0;
        p.nx = cth; p.ny = sth; p.nz = 0;
      } else {
        var slope = DEPTH / R;              
        var nl = Math.sqrt(slope * slope + 1);
        p.z = p.side * DEPTH * (1 - u);
        p.nx = cth * slope / nl;
        p.ny = sth * slope / nl;
        p.nz = p.side / nl;
      }
    }
  }

  // Drawing
  function draw() {
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var cx = W / 2, cy = H / 2;
    var R  = Math.min(W, H) * 0.40;

    var reach = Math.min(W, H) * 0.5;
    var halo = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, reach);
    halo.addColorStop(0.00, 'rgba(12, 42, 74, .13)');
    halo.addColorStop(0.55, 'rgba(12, 42, 74, .06)');
    halo.addColorStop(1.00, 'rgba(12, 42, 74, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // Rotation
    var cr = Math.cos(rot), sr = Math.sin(rot);
    var ct = Math.cos(TILT), st = Math.sin(TILT);

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], o = buf[i];

      var x1 =  p.x * cr - p.z * sr;
      var z1 =  p.x * sr + p.z * cr;
      var y2 =  p.y * ct - z1 * st;
      var z2 =  p.y * st + z1 * ct;

      var mx =  p.nx * cr - p.nz * sr;
      var mz1 = p.nx * sr + p.nz * cr;
      var my =  p.ny * ct - mz1 * st;
      var mz =  p.ny * st + mz1 * ct;

      var up = -my;                       
      var env = (up + 1) * 0.5;
      env = env * env * (3 - 2 * env);    
      env = 0.06 + 0.94 * env;

      var sp = mx * HX + my * HY + mz * HZ;
      sp = sp > 0 ? Math.pow(sp, SHINE) : 0;

      if (mz > 0) env *= 0.86;

      var bright = env + sp * 0.9;
      if (bright > 1) bright = 1;

      var face = mz < 0 ? -mz : mz;
      var fres = Math.pow(1 - face, FRESNEL);
      var alpha = fres + sp * 0.8;
      if (alpha > 1) alpha = 1;

      var kk = FOV / (FOV + z2);
      o.sx = cx + x1 * R * kk;
      o.sy = cy + y2 * R * kk;
      o.k = kk; o.z = z2; o.s = p.s;
      o.img = sprites[Math.round(bright * (LEVELS - 1)) * ALPHAS +
                      Math.round(alpha * (ALPHAS - 1))];
      o.spec = sp;
    }

    buf.sort(function (a, b) { return b.z - a.z; });

    ctx.globalCompositeOperation = 'source-over';
    for (var n = 0; n < buf.length; n++) {
      var d = buf[n];
      var size = d.s * R * GRAIN * d.k;
      ctx.drawImage(d.img, d.sx - size / 2, d.sy - size / 2, size, size);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (var m = 0; m < buf.length; m++) {
      var f = buf[m];
      if (f.spec < 0.22) continue;
      var fs = f.s * R * 0.065 * f.k;
      ctx.globalAlpha = Math.min(1, f.spec * 1.4);
      ctx.drawImage(flare, f.sx - fs / 2, f.sy - fs / 2, fs, fs);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Mouse Movement
  function updateTarget() {
    if (mouseX === null) { target = SPEED_IDLE; return; }
    var rect = canvas.getBoundingClientRect();
    var dx = mouseX - (rect.left + rect.width / 2);
    var dy = mouseY - (rect.top + rect.height / 2);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var near = 1 - dist / REACH;
    if (near < 0) near = 0;
    target = SPEED_IDLE + (SPEED_MAX - SPEED_IDLE) * near * near;
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    updateTarget();
    speed += (target - speed) * Math.min(1, dt * 3.2);
    rot += speed * dt;

    var flow = speed / SPEED_IDLE;
    if (flow > 5) flow = 5;
    advance(dt, flow);

    draw();
    requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  advance(0, 1);          
  window.addEventListener('resize', resize);
  resize();

  if (reduced) { draw(); return; }

  window.addEventListener('pointermove', function (ev) {
    mouseX = ev.clientX; mouseY = ev.clientY;
  }, { passive: true });
  document.addEventListener('pointerleave', function () {
    mouseX = mouseY = null;
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0 }).observe(canvas);
  } else {
    start();
  }
})();

// Fade In the Cards while Scrolling
(function () {
  var targets = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  targets.forEach(function (el) { io.observe(el); });
})();

// Project Card slide to the left while keep scrolling
(function () {
  var section = document.getElementById('project');
  var track   = document.getElementById('railTrack');
  var rail    = document.getElementById('rail');
  var bar     = document.getElementById('railBar');
  if (!section || !track || !rail) return;

  var stage  = track.firstElementChild;
  var wide   = window.matchMedia('(min-width: 62rem) and (min-height: 34rem)');
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var PACE = 0.6;
  var shift = 0, ticking = false;

  function measure() {
    if (!wide.matches || motion.matches) {
      section.classList.remove('is-pinned');
      track.style.height = '';
      rail.style.transform = '';
      if (bar) bar.style.width = '';
      shift = 0;
      return;
    }

    section.classList.add('is-pinned');
    rail.style.transform = 'translate3d(0,0,0)';
    shift = rail.scrollWidth - stage.clientWidth;

    if (shift <= 0) {           
      section.classList.remove('is-pinned');
      track.style.height = '';
      rail.style.transform = '';
      shift = 0;
      return;
    }

    track.style.height = (stage.offsetHeight + shift * PACE) + 'px';
    update();
  }

  function update() {
    ticking = false;
    if (shift <= 0) return;
    var total = track.offsetHeight - stage.offsetHeight;
    if (total <= 0) return;
    var p = -track.getBoundingClientRect().top / total;
    if (p < 0) p = 0; else if (p > 1) p = 1;
    rail.style.transform = 'translate3d(' + (-p * shift).toFixed(2) + 'px,0,0)';
    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
  }

  window.addEventListener('scroll', function () {
    if (!ticking && shift > 0) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });

  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
})();


// Magazin
(function () {
  var box = document.getElementById('mag');
  if (!box) return;

  var img  = document.getElementById('magImg');
  var now  = document.getElementById('magNow');
  var prev = box.querySelector('.prev');
  var next = box.querySelector('.next');
  var total = parseInt(box.getAttribute('data-pages'), 10) || 1;
  var page = 1;

  function src(n) { return 'images/magazine/page-' + n + '.jpg'; }

  function preload(n) {
    if (n >= 1 && n <= total) { var i = new Image(); i.src = src(n); }
  }

  function show(n) {
    if (n < 1 || n > total || n === page) return;
    page = n;
    img.src = src(page);
    img.alt = 'Serenity magazine, page ' + page + ' of ' + total;
    now.textContent = page;
    prev.disabled = (page === 1);
    next.disabled = (page === total);
    preload(page + 1);
    preload(page - 1);
  }

  prev.addEventListener('click', function () { show(page - 1); });
  next.addEventListener('click', function () { show(page + 1); });

  // Arrow to Swipe through Pages
  box.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowRight') { show(page + 1); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft')  { show(page - 1); ev.preventDefault(); }
  });

  prev.disabled = true;
  preload(2);
})();