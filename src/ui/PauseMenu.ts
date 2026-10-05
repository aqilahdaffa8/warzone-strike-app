import { PlayerController } from '../player/PlayerController';

export class PauseMenu {
  private readonly root: HTMLElement | null;
  private readonly resumeBtn: HTMLButtonElement | null;
  private readonly sensitivitySlider: HTMLInputElement | null;
  private readonly sensitivityValueText: HTMLElement | null;

  private onResumeCallback?: () => void;

  constructor(controller: PlayerController) {
    this.root = document.querySelector<HTMLElement>('#pause-overlay');
    this.resumeBtn = document.querySelector<HTMLButtonElement>('#btn-resume');
    this.sensitivitySlider = document.querySelector<HTMLInputElement>('#slider-sensitivity');
    this.sensitivityValueText = document.querySelector<HTMLElement>('#val-sensitivity');

    this.setupListeners(controller);
  }

  public setOnResume(cb: () => void): void {
    this.onResumeCallback = cb;
  }

  private setupListeners(controller: PlayerController): void {
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
