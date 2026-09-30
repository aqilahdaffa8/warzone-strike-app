import { PlayerController } from '../player/PlayerController';
import { PlayerHealth } from '../player/PlayerHealth';

export class PauseMenu {
  private readonly root: HTMLElement | null;
  private readonly resumeBtn: HTMLButtonElement | null;
  private readonly sensitivitySlider: HTMLInputElement | null;
  private readonly sensitivityValueText: HTMLElement | null;
  private readonly pauseDamageBtn: HTMLButtonElement | null;
  private readonly pauseResetBtn: HTMLButtonElement | null;

  private onResumeCallback?: () => void;

  constructor(controller: PlayerController, health: PlayerHealth) {
    this.root = document.querySelector<HTMLElement>('#pause-overlay');
    this.resumeBtn = document.querySelector<HTMLButtonElement>('#btn-resume');
    this.sensitivitySlider = document.querySelector<HTMLInputElement>('#slider-sensitivity');
    this.sensitivityValueText = document.querySelector<HTMLElement>('#val-sensitivity');
    this.pauseDamageBtn = document.querySelector<HTMLButtonElement>('#btn-pause-damage');
    this.pauseResetBtn = document.querySelector<HTMLButtonElement>('#btn-pause-reset');

    this.setupListeners(controller, health);
  }

  public setOnResume(cb: () => void): void {
    this.onResumeCallback = cb;
  }

  private setupListeners(controller: PlayerController, health: PlayerHealth): void {
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onResumeCallback) {
          this.onResumeCallback();
        }
      });
    }

    if (this.sensitivitySlider) {
      // Initialize slider with current sensitivity
      const currentSens = controller.getSensitivity();
      this.sensitivitySlider.value = currentSens.toString();
      if (this.sensitivityValueText) {
        this.sensitivityValueText.textContent = currentSens.toFixed(4);
      }

      this.sensitivitySlider.addEventListener('input', () => {
        const val = parseFloat(this.sensitivitySlider!.value);
        controller.setSensitivity(val);
        if (this.sensitivityValueText) {
          this.sensitivityValueText.textContent = val.toFixed(4);
        }
      });
    }

    if (this.pauseDamageBtn) {
      this.pauseDamageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        health.takeDamage(15);
      });
    }

    if (this.pauseResetBtn) {
      this.pauseResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        health.reset();
      });
    }
  }

  public show(): void {
    if (this.root) {
      this.root.style.display = 'flex';
    }
  }

  public hide(): void {
    if (this.root) {
      this.root.style.display = 'none';
    }
  }
}
