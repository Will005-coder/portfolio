import { useEffect, useRef } from "react";

export default function AnimatedBackground({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Store mouse in a ref so the rAF loop always reads the latest value
  const mouse = useRef({ x: 0.5, y: 0.5, moved: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Parse hex once per accentColor change
    const hex = accentColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // ── Two independent spring points ──────────────────────────────────────────
    // sp1 follows the cursor closely (tighter spring = snappier lead)
    // sp2 follows sp1 lazily (looser, more organic tail)
    const sp1 = { x: 0.5, y: 0.4, vx: 0, vy: 0 };
    const sp2 = { x: 0.6, y: 0.6, vx: 0, vy: 0 };

    const K1 = 0.10;  // stiffness for sp1 → cursor  (higher = snappier response)
    const K2 = 0.045; // stiffness for sp2 → sp1     (lower = lazy follow)
    const DAMP = 0.78; // shared damping (lower = more oscillation/bounce)

    let t = 0;
    let raf: number;

    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const isMobile = window.matchMedia("(pointer: coarse)").matches;

    function onMouseMove(e: MouseEvent) {
      mouse.current.x = e.clientX / window.innerWidth;
      mouse.current.y = e.clientY / window.innerHeight;
      mouse.current.moved = true;
    }
    if (!isMobile) window.addEventListener("mousemove", onMouseMove);

    function stepSpring(
      sp: { x: number; y: number; vx: number; vy: number },
      tx: number, ty: number, k: number, damp: number
    ) {
      sp.vx = (sp.vx - (sp.x - tx) * k) * damp;
      sp.vy = (sp.vy - (sp.y - ty) * k) * damp;
      sp.x += sp.vx;
      sp.y += sp.vy;
    }

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      t += 0.007;

      // Idle drift targets (used when mouse hasn't moved yet or on mobile)
      const idleX = 0.5 + 0.20 * Math.sin(t * 0.5);
      const idleY = 0.4 + 0.18 * Math.cos(t * 0.38 + 0.8);

      const targetX = (!isMobile && mouse.current.moved) ? mouse.current.x : idleX;
      const targetY = (!isMobile && mouse.current.moved) ? mouse.current.y : idleY;

      // sp1 chases cursor directly
      stepSpring(sp1, targetX, targetY, K1, DAMP);
      // sp2 chases sp1 with lag
      stepSpring(sp2, sp1.x, sp1.y, K2, DAMP + 0.06);

      // Anchor points drift gently for organic feel
      const aStartX = W * (0.02 + 0.02 * Math.sin(t * 0.28));
      const aStartY = H * (0.50 + 0.10 * Math.cos(t * 0.33));
      const aEndX   = W * (0.98 - 0.02 * Math.cos(t * 0.22));
      const aEndY   = H * (0.48 + 0.12 * Math.sin(t * 0.30 + 0.6));

      // Primary path: anchors → sp2 (lazy) → sp1 (leads) → anchors
      // Using sp2 as CP1 and sp1 as CP2 creates: path starts from left,
      // arcs through the lazy follow point, then bends toward cursor
      const cp1x = W * sp2.x;
      const cp1y = H * sp2.y;
      const cp2x = W * sp1.x;
      const cp2y = H * sp1.y;

      // ── Speed of spring movement → modulate opacity for "intent" feedback ──
      const speed = Math.sqrt(sp1.vx ** 2 + sp1.vy ** 2);
      const intentOpacity = 0.18 + Math.min(speed * 12, 0.30); // 0.18 idle → up to 0.48 on fast move

      // Primary dashed line
      ctx.beginPath();
      ctx.moveTo(aStartX, aStartY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, aEndX, aEndY);
      ctx.strokeStyle = `rgba(${r},${g},${b},${intentOpacity.toFixed(3)})`;
      ctx.lineWidth = 1.5 + speed * 8; // line fattens slightly on fast motion
      ctx.setLineDash([5, 11]);
      ctx.lineDashOffset = -t * 22;
      ctx.stroke();

      // Echo path, offset anchors, follows sp2 only (more delayed)
      const bStartX = W * (0.0  + 0.03 * Math.cos(t * 0.31 + 1.4));
      const bStartY = H * (0.68 + 0.07 * Math.sin(t * 0.27 + 0.3));
      const bEndX   = W * (1.0  - 0.03 * Math.sin(t * 0.25 + 0.9));
      const bEndY   = H * (0.28 + 0.09 * Math.cos(t * 0.35 + 1.2));
      const bcp1x   = W * (sp2.x + 0.10 * Math.sin(t * 0.42));
      const bcp1y   = H * (sp2.y - 0.08 * Math.cos(t * 0.38));
      const bcp2x   = W * (sp1.x - 0.08 * Math.cos(t * 0.33 + 0.5));
      const bcp2y   = H * (sp1.y + 0.06 * Math.sin(t * 0.44 + 0.7));

      ctx.beginPath();
      ctx.moveTo(bStartX, bStartY);
      ctx.bezierCurveTo(bcp1x, bcp1y, bcp2x, bcp2y, bEndX, bEndY);
      ctx.strokeStyle = `rgba(${r},${g},${b},${(intentOpacity * 0.38).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 18]);
      ctx.lineDashOffset = t * 14;
      ctx.stroke();

      // ── Soft glow dot at cursor / spring-lead position ──────────────────────
      if (!isMobile) {
        const glowX = W * sp1.x;
        const glowY = H * sp1.y;
        const glowR = 28 + speed * 120;
        const grad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
        grad.addColorStop(0,   `rgba(${r},${g},${b},${(0.08 + speed * 0.4).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(glowX, glowY, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.setLineDash([]);
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [accentColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", display: "block" }}
    />
  );
}
