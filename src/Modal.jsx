import { useEffect, useRef } from "react";
import { IconX } from "@tabler/icons-react";

export function Modal({ title, titleId, onClose, children, className = "" }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';
    (dialog.querySelector(selector) || dialog).focus();
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === "Tab") {
        const items = [...dialog.querySelectorAll(selector)].filter((el) => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.addEventListener("keydown", onKey);
    return () => { dialog.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className={`template-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="modal-head"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="关闭对话框" onClick={onClose}><IconX size={20} /></button></div>{children}</section></div>;
}
