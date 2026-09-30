export type ToastType = "default" | "warning" | "error";

const ICONS: Record<ToastType, string> = {
  default: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(70.4% 0.191 22.216)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
};

export class Toaster {
  private toasts = new Map<string, ReturnType<typeof setTimeout>>();
  private toastCount: number = 1;
  private template: HTMLTemplateElement;
  private toastDuration = 1400;

  constructor(private readonly oven: HTMLElement | null) {
    if (!oven) throw new Error("missing oven element");

    const template =
      document.querySelector<HTMLTemplateElement>("#toast__template");
    if (!template) throw new Error("missing toast template");
    this.template = template;
  }

  toast(message: string, type: ToastType = "default") {
    const toastId = `${type}_toast_${this.toastCount}`;
    this.createToast(toastId, message, ICONS[type]);
    const timer = setTimeout(
      () => this.cleanUpToast(toastId, timer),
      this.toastDuration,
    );
    this.toasts.set(toastId, timer);
    this.toastCount++;
    return;
  }

  private cleanUpToast(id: string, timer: ReturnType<typeof setTimeout>) {
    if (this.toasts.has(id)) {
      const toastEl = document.getElementById(id) as HTMLElement;
      toastEl.classList.remove("open");
      clearTimeout(timer);
      this.toasts.delete(id);
      this.restack();
      this.deleteToastNode(toastEl);
    }
  }

  private deleteToastNode(toastEl: HTMLElement) {
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined = undefined;
    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "opacity") return;
      toastEl.remove();
      toastEl.removeEventListener("transitionend", handleTransitionEnd);
      clearTimeout(fallbackTimer);
    };

    toastEl.addEventListener("transitionend", handleTransitionEnd);
    fallbackTimer = setTimeout(() => toastEl.remove(), 500);
  }

  private createToast(id: string, message: string, icon: string) {
    const element = this.template.content.cloneNode(true) as DocumentFragment;
    const wrapperEl = element.querySelector<HTMLElement>(".toast");

    if (!wrapperEl) {
      throw new Error('missing ".toast" wrapper element');
    }
    wrapperEl.setAttribute("id", id);
    wrapperEl.setAttribute("data-index", id);
    const messageEl = wrapperEl.querySelector(".toast__message");
    messageEl!.textContent = message;

    const domParser = new DOMParser();
    const svgDoc = domParser.parseFromString(icon, "image/svg+xml");
    const iconEl = svgDoc.documentElement;
    wrapperEl.insertBefore(iconEl, messageEl!);

    const dismissBtn = wrapperEl.querySelector(".toast__dismiss-btn");
    dismissBtn?.addEventListener("click", () => {
      if (this.toasts.has(id)) {
        this.cleanUpToast(id, this.toasts.get(id)!);
      }
    });

    this.oven!.appendChild(element);
    wrapperEl.classList.add("open");
    this.restack();
  }

  private restack() {
    const items = [...this.oven!.querySelectorAll<HTMLElement>(".toast.open")];
    items
      .reverse()
      .forEach((el, i) => el.style.setProperty("--stack-index", String(i)));
  }
}
