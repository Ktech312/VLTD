/**
 * Lightweight DOM toast — no React deps, works in components and lib files.
 * Stacks multiple toasts vertically above each other.
 */

let offset = 0;

/** Optional button inside the toast, e.g. Undo. Clicking it runs once and closes the toast. */
export type ToastAction = { label: string; onClick: () => void };

export function showToast(msg: string, duration = 3000, action?: ToastAction) {
  if (typeof document === "undefined") return;

  const id = `vltd-toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  offset += 52;
  const bottom = 24 + offset - 52;

  const el = document.createElement("div");
  el.id = id;
  el.textContent = msg;
  let closed = false;
  el.setAttribute(
    "style",
    [
      "position:fixed",
      `bottom:${bottom}px`,
      "left:50%",
      "transform:translateX(-50%) translateY(0)",
      "background:var(--surface,#1e1e1e)",
      "color:var(--fg,#f0ead6)",
      "border:1px solid var(--border,rgba(255,255,255,0.12))",
      "padding:10px 20px",
      "border-radius:14px",
      "font-size:13px",
      "font-weight:600",
      "z-index:99999",
      action ? "pointer-events:auto" : "pointer-events:none",
      "box-shadow:0 4px 24px rgba(0,0,0,0.45)",
      "white-space:nowrap",
      "opacity:0",
      "transition:opacity 0.18s ease,transform 0.18s ease",
    ].join(";"),
  );

  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = action.label;
    btn.setAttribute(
      "style",
      "margin-left:12px;background:transparent;border:none;color:var(--theme-gold,#C8CDD2);font-weight:800;font-size:13px;cursor:pointer;text-decoration:underline",
    );
    btn.addEventListener("click", () => {
      if (closed) return;
      action.onClick();
      close();
    });
    el.appendChild(btn);
  }

  document.body.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = "1";
    });
  });

  // Animate out and remove
  function close() {
    if (closed) return;
    closed = true;
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(6px)";
    setTimeout(() => {
      el.remove();
      offset = Math.max(0, offset - 52);
    }, 200);
  }
  setTimeout(close, duration);
}
