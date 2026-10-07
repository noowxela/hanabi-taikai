import { audio } from '../audio/audio';
import type { Direction, InputHandlers } from '../input';

export interface HudButton {
  label: string;
  onClick?(): void;
  /** Pointer is held down. Used by the touch run button. */
  onHold?(down: boolean): void;
  touchOnly?: boolean;
  disabled?: boolean;
}

export interface HudConfig {
  title: string;
  hint?: { desktop: string; touch: string };
  buttons?: HudButton[];
  /** Touch joystick for movement. */
  joystick?: boolean;
  /** Touch action button; `label` defaults to 互动. */
  action?: { label?: string } | false;
  /** Touch 4-way pad that fires `direction` events. */
  dpad?: boolean;
}

export interface PanelAction {
  label: string;
  onClick?(): void;
  primary?: boolean;
  disabled?: boolean;
  /** Keep the panel open after clicking. */
  keepOpen?: boolean;
}

export const FADE_MS = 320;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

export function starText(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export class Overlay {
  private readonly title: HTMLDivElement;
  private readonly subtitle: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private readonly buttons: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly dialogBox: HTMLDivElement;
  private readonly dialogSpeaker: HTMLDivElement;
  private readonly dialogText: HTMLDivElement;
  private readonly toastBox: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly fadeLayer: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly panelTitle: HTMLDivElement;
  private readonly panelBody: HTMLDivElement;
  private readonly panelActions: HTMLDivElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private dialogLines: string[] = [];
  private panelPrimary: (() => void) | null = null;
  private panelDismissible = true;
  private toastTimer = 0;
  private bannerTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    handlers: InputHandlers,
  ) {
    const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    root.classList.toggle('touch', touch);
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') root.classList.add('touch');
    });

    const hud = el('div', 'hud', root);
    this.title = el('div', 'hud-title', hud);
    this.subtitle = el('div', 'hud-subtitle', hud);
    this.stats = el('div', 'hud-stats', hud);
    this.buttons = el('div', 'hud-buttons', root);
    this.muteButton = el('button', 'pixel-button', this.buttons, audio.muted ? '声音' : '静音');
    this.muteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.toggleMuted();
      this.muteButton.textContent = audio.muted ? '声音' : '静音';
    });

    this.prompt = el('div', 'prompt', root);
    this.toastBox = el('div', 'toast', root);
    this.banner = el('div', 'banner', root);

    this.dialogBox = el('div', 'dialog', root);
    this.dialogSpeaker = el('div', 'dialog-speaker', this.dialogBox);
    this.dialogText = el('div', 'dialog-text', this.dialogBox);
    el('div', 'dialog-next', this.dialogBox, '▼');
    this.dialogBox.addEventListener('click', () => handlers.action());

    this.actionButton = el('button', 'pixel-button action-button', root, '互动');
    this.actionButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.click();
      handlers.action();
    });

    const dpad = el('div', 'dpad', root);
    const arrows: [Direction, string][] = [
      ['up', '▲'],
      ['left', '◀'],
      ['right', '▶'],
      ['down', '▼'],
    ];
    for (const [dir, label] of arrows) {
      const b = el('button', `pixel-button dpad-${dir}`, dpad, label);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handlers.direction(dir);
      });
    }

    this.panel = el('div', 'panel', root);
    const box = el('div', 'panel-box', this.panel);
    this.panelTitle = el('div', 'panel-title', box);
    this.panelBody = el('div', 'panel-body', box);
    this.panelActions = el('div', 'panel-actions', box);
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel && this.panelDismissible) this.hidePanel();
    });

    this.fadeLayer = el('div', 'fade', root);
  }

  /** True while a modal UI element should block gameplay input. */
  get busy(): boolean {
    return this.dialogOpen || this.panelOpen;
  }

  get dialogOpen(): boolean {
    return this.dialogBox.classList.contains('open');
  }

  get panelOpen(): boolean {
    return this.panel.classList.contains('open');
  }

  setHud(config: HudConfig): void {
    this.title.textContent = config.title;
    this.subtitle.innerHTML = '';
    if (config.hint) {
      el('span', 'only-desktop', this.subtitle, config.hint.desktop);
      el('span', 'only-touch', this.subtitle, config.hint.touch);
    }
    this.stats.innerHTML = '';
    this.setButtons(config.buttons ?? []);
    this.root.classList.toggle('show-joystick', !!config.joystick);
    this.root.classList.toggle('show-action', !!config.action);
    this.root.classList.toggle('show-dpad', !!config.dpad);
    this.actionButton.textContent = (config.action && config.action.label) || '互动';
    this.setPrompt(null);
  }

  setButtons(buttons: HudButton[]): void {
    this.buttons.innerHTML = '';
    for (const b of buttons) {
      const node = el('button', `pixel-button${b.touchOnly ? ' only-touch' : ''}`, this.buttons, b.label);
      node.disabled = !!b.disabled;
      if (b.onHold) {
        const release = (e: PointerEvent) => {
          if (!node.hasPointerCapture(e.pointerId)) return;
          node.releasePointerCapture(e.pointerId);
          b.onHold?.(false);
        };
        node.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          node.setPointerCapture(e.pointerId);
          b.onHold?.(true);
        });
        node.addEventListener('pointerup', release);
        node.addEventListener('pointercancel', release);
      } else if (b.onClick) {
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          node.blur();
          audio.click();
          b.onClick?.();
        });
      }
    }
    this.buttons.appendChild(this.muteButton);
  }

  setStats(main: string, sub = ''): void {
    this.stats.innerHTML = '';
    el('div', '', this.stats, main);
    if (sub) el('div', 'hud-hint', this.stats, sub);
  }

  setPrompt(label: string | null, detail?: string): void {
    this.prompt.classList.toggle('open', label !== null);
    this.actionButton.classList.toggle('ready', label !== null);
    if (label === null) return;
    this.prompt.innerHTML = '';
    el('span', 'prompt-label', this.prompt, label);
    if (detail) el('span', 'prompt-detail', this.prompt, detail);
    el('span', 'prompt-key only-desktop', this.prompt, '空格');
  }

  /** Marks the touch action button as usable without showing a prompt. */
  setActionReady(ready: boolean): void {
    this.actionButton.classList.toggle('ready', ready);
  }

  openDialog(speaker: string, lines: string[]): void {
    if (lines.length === 0) return;
    this.dialogLines = lines.slice(1);
    this.dialogSpeaker.textContent = speaker;
    this.dialogText.textContent = lines[0];
    this.dialogBox.classList.add('open');
    this.prompt.classList.remove('open');
  }

  advanceDialog(): void {
    const next = this.dialogLines.shift();
    if (next !== undefined) this.dialogText.textContent = next;
    else this.closeDialog();
  }

  closeDialog(): void {
    this.dialogBox.classList.remove('open');
    if (this.actionButton.classList.contains('ready') && this.prompt.childElementCount > 0) {
      this.prompt.classList.add('open');
    }
  }

  showPanel(title: string, body: HTMLElement | string, actions: PanelAction[] = [{ label: '关闭' }], dismissible = true): void {
    this.panelTitle.textContent = title;
    this.panelBody.innerHTML = '';
    if (typeof body === 'string') el('div', 'panel-text', this.panelBody, body);
    else this.panelBody.appendChild(body);
    this.panelActions.innerHTML = '';
    this.panelPrimary = null;
    for (const action of actions) {
      const node = el('button', `pixel-button${action.primary ? ' primary' : ''}`, this.panelActions, action.label);
      node.disabled = !!action.disabled;
      const run = () => {
        audio.click();
        if (!action.keepOpen) this.hidePanel();
        action.onClick?.();
      };
      node.addEventListener('click', run);
      if (!action.disabled && (action.primary || this.panelPrimary === null)) this.panelPrimary = run;
    }
    this.panelDismissible = dismissible;
    this.panel.classList.add('open');
  }

  /** Space / Enter while a panel is open: run its primary action. */
  activatePanel(): void {
    if (this.panelPrimary) this.panelPrimary();
    else if (this.panelDismissible) this.hidePanel();
  }

  /** Esc while a panel is open. Returns false if the panel cannot be dismissed. */
  dismissPanel(): boolean {
    if (!this.panelDismissible) return false;
    this.hidePanel();
    return true;
  }

  hidePanel(): void {
    this.panel.classList.remove('open');
  }

  toast(text: string): void {
    this.toastBox.textContent = text;
    this.toastBox.classList.add('open');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastBox.classList.remove('open'), 2600);
  }

  /** Big centred text (countdowns, "时间到！"). */
  flash(text: string, ms = 800): void {
    this.banner.textContent = text;
    this.banner.classList.remove('open');
    void this.banner.offsetWidth;
    this.banner.classList.add('open');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('open'), ms);
  }

  async fade(during: () => void): Promise<void> {
    this.fadeLayer.classList.add('open');
    await new Promise((r) => setTimeout(r, FADE_MS));
    during();
    this.fadeLayer.classList.remove('open');
    await new Promise((r) => setTimeout(r, FADE_MS));
  }
}
