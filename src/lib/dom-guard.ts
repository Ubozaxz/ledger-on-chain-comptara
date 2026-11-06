/**
 * Browser translation tools (Google Translate in Chrome Android, etc.) and some
 * extensions rewrite text nodes behind React's back. React then crashes with
 * "Failed to execute 'removeChild' / 'insertBefore' on 'Node'" on the next click.
 * These guards make those two DOM calls tolerant so the app keeps working.
 */
export function installDomGuard() {
  if (typeof Node === "undefined" || (Node.prototype as any).__comptaraGuard) return;
  (Node.prototype as any).__comptaraGuard = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) return originalRemoveChild.call(child.parentNode, child) as T;
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, ref) as T;
  };
}
