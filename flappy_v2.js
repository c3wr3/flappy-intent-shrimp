(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const startBtn = document.getElementById('startBtn');
  const intentSel = document.getElementById('intent');
  const skinSel = document.getElementById('skin');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const intentLabel = document.getElementById('intentLabel');

  // assets
  const skins = {
    red: new Image(),
    neon: new Image()
  };
  skins.red.src = 'assets/shrimp_red.png';
  skins.neon.src = 'assets/shrimp_neon.png';

  bestEl.textContent = String(Number(localStorage.getItem('flappy_best_v2')||0));

  let state = {
    running: false,
    over: false,
    score: 0,
    best: Number(localStorage.getItem('flappy_best_v2')||0),
    t: 0,
    // Bird
    x: 110,
    y: H/2,
    vy: 0,
    gravity: 0.5,
    flap: -8,
    sprite: 'red',
    // Pipes
    pipes: [],
    pipeGap: 145,
    pipeW: 64,
    pipeEvery: 1400,
    lastPipe: 0,
    // Intent
    intent: 'shield',
    shield: {charges: 1, invuln: 0},
    scoreBoost: 1,
    // Input
    lastFrame: 0,
    reqId: null
  };

  function reset(intent, sprite){
    state.running = true;
    state.over = false;
    state.score = 0;
    scoreEl.textContent = '0';
    state.t = 0;
    state.x = 110;
    state.y = H/2;
    state.vy = 0;
    state.pipes = [];
    state.lastPipe = 0;
    state.intent = intent || 'shield';
    state.sprite = sprite || 'red';
    // intent params
    if (state.intent === 'speed'){
      state.pipeGap = 165; // wider gaps
      state.shield.charges = 0;
      state.scoreBoost = 1;
    } else if (state.intent === 'shield'){
      state.pipeGap = 145;
      state.shield.charges = 1; // one forgiveness
      state.scoreBoost = 1;
    } else { // score
      state.pipeGap = 135; // a bit tighter
      state.shield.charges = 0;
      state.scoreBoost = 2; // double points
    }
    state.shield.invuln = 0;

    spawnPipe();
    spawnPipe(260);
    spawnPipe(520);
    state.lastFrame = performance.now();
    if (state.reqId) cancelAnimationFrame(state.reqId);
    state.reqId = requestAnimationFrame(loop);
  }

  function spawnPipe(offsetX){
    const gap = state.pipeGap;
    const minY = 70, maxY = H-70-gap;
    const topY = Math.floor(minY + Math.random()*(maxY-minY));
    const x = (typeof offsetX === 'number') ? (W + offsetX) : W + 40;
    state.pipes.push({x, topY, passed:false});
  }

  function flap(){ state.vy = state.flap; }

  function loop(now){
    const dt = Math.min(32, now - state.lastFrame);
    state.lastFrame = now;
    update(dt);
    draw();
    if (state.running) state.reqId = requestAnimationFrame(loop);
  }

  function update(dt){
    state.t += dt;
    if (state.t - state.lastPipe > state.pipeEvery){
      spawnPipe();
      state.lastPipe = state.t;
    }
    // physics
    state.vy += state.gravity;
    state.y += state.vy;
    if (state.y > H-20){ collide(); }
    if (state.y < 0){ state.y = 0; state.vy = 0.1; }

    const speed = 2.4;
    for (let p of state.pipes){
      p.x -= speed;
      if (!p.passed && p.x + state.pipeW < state.x){
        p.passed = true;
        addScore(1 * state.scoreBoost);
      }
      const inX = state.x > p.x-20 && state.x < p.x + state.pipeW;
      const gapTop = p.topY;
      const gapBot = p.topY + state.pipeGap;
      const inGap = state.y > gapTop && state.y < gapBot;
      if (inX && !inGap) collide();
    }
    state.pipes = state.pipes.filter(p => p.x > -state.pipeW-10);
    if (state.shield.invuln > 0) state.shield.invuln -= dt;
  }

  function collide(){
    if (state.intent === 'shield' && (state.shield.charges > 0 || state.shield.invuln > 0)){
      if (state.shield.invuln <= 0){
        state.shield.charges -= 1;
        state.shield.invuln = 1500;
        toast('Shield absorbed a hit 🛡️');
      }
      state.vy = -6;
      return;
    }
    state.running = false;
    state.over = true;
    if (state.score > state.best){
      state.best = state.score;
      localStorage.setItem('flappy_best_v2', String(state.best));
      bestEl.textContent = String(state.best);
    }
    toast(`Game Over — Score ${state.score}`);
  }

  function addScore(n){ state.score += n; scoreEl.textContent = String(state.score); }

  function drawSeaBackground(){
    // subtle parallax bubbles
    for (let i=0;i<60;i++){
      const x = (i*53 + (state.t*0.04)) % W;
      const y = (i*37 % H);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(x, y, (i%3)+1, 0, Math.PI*2); ctx.fill();
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    drawSeaBackground();
    // pipes
    for (let p of state.pipes){
      ctx.fillStyle = '#155577';
      ctx.fillRect(p.x, 0, state.pipeW, p.topY);
      ctx.fillRect(p.x, p.topY + state.pipeGap, state.pipeW, H - (p.topY + state.pipeGap));
      ctx.fillStyle = '#1e7aa3';
      ctx.fillRect(p.x, p.topY-10, state.pipeW, 10);
      ctx.fillRect(p.x, p.topY + state.pipeGap, state.pipeW, 10);
    }
    // shrimp sprite
    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.rotate(Math.max(-0.5, Math.min(0.6, state.vy/12)));
    const img = skins[state.sprite];
    const w = 64, h = 48;
    ctx.drawImage(img, -w/2, -h/2, w, h);
    ctx.restore();

    if (state.intent === 'shield' && (state.shield.invuln > 0 || state.shield.charges > 0)){
      ctx.save();
      ctx.globalAlpha = state.shield.invuln > 0 ? 0.5 : 0.22;
      ctx.strokeStyle = '#90e0ef';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(state.x, state.y, 26, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#052b57';
    ctx.fillRect(0,H-8,W,8);

    if (!state.running){
      ctx.fillStyle = 'rgba(7,26,42,0.5)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#e8eefc';
      ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE / TAP to flap', W/2, H/2 - 10);
      ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial, sans-serif';
      ctx.fillText('Pick intent & skin then press Start', W/2, H/2 + 18);
    }
  }

  function toast(msg){
    const n = document.createElement('div');
    n.className = 'toast';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(()=>n.remove(), 1800);
  }

  // Input
  window.addEventListener('keydown', e => {
    if (e.code === 'Space'){
      e.preventDefault();
      if (!state.running || state.over) return;
      flap();
    }
  });
  canvas.addEventListener('pointerdown', () => {
    if (!state.running || state.over) return;
    flap();
  });

  // Start button
  startBtn.addEventListener('click', () => {
    const intent = intentSel.value;
    const sprite = skinSel.value;
    intentLabel.textContent = intent.charAt(0).toUpperCase() + intent.slice(1);
    reset(intent, sprite);
  });

  // First draw
  draw();
})();