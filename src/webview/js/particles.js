// ── PARTICLES ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('particle-canvas');
const ctx2d = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  const gc = document.getElementById('graph-container');
  canvas.width = gc.offsetWidth;
  canvas.height = gc.offsetHeight;
}

function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, decay: 0.025 + Math.random() * 0.02, size: 2 + Math.random() * 2.5, color });
  }
}

function animateParticles() {
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.95; p.vy *= 0.95;
    p.life -= p.decay;
    ctx2d.globalAlpha = Math.max(0, p.life);
    ctx2d.fillStyle = p.color;
    ctx2d.beginPath();
    ctx2d.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx2d.fill();
  }
  ctx2d.globalAlpha = 1;
  requestAnimationFrame(animateParticles);
}

// ── RIPPLE ───────────────────────────────────────────────────────────────────
function spawnRipple(x, y, color) {
  const gc = document.getElementById('graph-container');
  const el = document.createElement('div');
  el.className = 'expand-ripple';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.borderColor = color;
  gc.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function spawnExpandBadge(x, y, count) {
  const gc = document.getElementById('graph-container');
  const el = document.createElement('div');
  el.className = 'expand-badge';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.textContent = `+${count} nodes`;
  gc.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function cyPosToContainer(cyPos) {
  const gc = document.getElementById('graph-container');
  const gcRect = gc.getBoundingClientRect();
  const cyEl = document.getElementById('cy');
  const cyRect = cyEl.getBoundingClientRect();
  return { x: cyPos.x + (cyRect.left - gcRect.left), y: cyPos.y + (cyRect.top - gcRect.top) };
}
