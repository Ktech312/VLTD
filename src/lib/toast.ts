/**
 * Lightweight DOM toast — no React deps, works in components and lib files.
 * Toasts sit in one fixed column (bottom on wide screens, just under the header on narrow
 * ones), never wider than the viewport; long messages wrap so nothing overlaps.
 */

/** Optional button inside the toast, e.g. Undo. Clicking it runs once and closes the toast. */
export type ToastAction = { label: string; onClick: () => void };

const STACK_ID = "vltd-toast-stack";

function getStack(): HTMLElement {
  let stack = document.getElementById(STACK_ID);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = STACK_ID;
    stack.setAttribute("aria-live", "polite");
    const narrow = window.innerWidth < 768;
    stack.setAttribute(
      "style",
      [
        "position:fixed",
        // Under 768px the bottom of the screen is taken (navigation bar, floating Add Item, bug-report
        // button, save-status note), so toasts drop in just under the header instead.
        narrow ? "top:calc(76px + env(safe-area-inset-top, 0px))" : "bottom:24px",
        "left:50%",
        "transform:translateX(-50%)",
        "width:max-content",
        "max-width:calc(100vw - 32px)",
        "display:flex",
        narrow ? "flex-direction:column" : "flex-direction:column-reverse",
        "align-items:center",
        "gap:8px",
        "z-index:99999",
        "pointer-events:none",
      ].join(";"),
    );
    document.body.appendChild(stack);
  }
  return stack;
}

export function showToast(msg: string, duration = 3000, action?: ToastAction) {
  if (typeof document === "undefined") return;

  const el = document.createElement("div");
  const text = document.createElement("span");
  text.textContent = msg;
  el.appendChild(text);
  let closed = false;
  el.setAttribute(
    "style",
    [
      "box-sizing:border-box",
      "max-width:100%",
      "background:var(--surface,#1e1e1e)",
      "color:var(--fg,#f0ead6)",
      "border:1px solid var(--border,rgba(255,255,255,0.12))",
      "padding:10px 16px",
      "border-radius:14px",
      "font-size:13px",
      "font-weight:600",
      "line-height:1.35",
      "text-align:center",
      "overflow-wrap:anywhere",
      action ? "pointer-events:auto" : "pointer-events:none",
      "box-shadow:0 4px 24px rgba(0,0,0,0.45)",
      "opacity:0",
      "transform:translateY(0)",
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

  getStack().appendChild(el);

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
    el.style.transform = "translateY(6px)";
    setTimeout(() => {
      el.remove();
      const stack = document.getElementById(STACK_ID);
      if (stack && stack.childElementCount === 0) stack.remove();
    }, 200);
  }
  setTimeout(close, duration);
}
