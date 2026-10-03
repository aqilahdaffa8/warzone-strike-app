import {
  getAkmGraphic,
  getM4Graphic,
  getBazookaGraphic,
  getHealthPackGraphic,
  getGrenadeGraphic,
  getMagazineUpgradeGraphic,
  getSniperAmmoGraphic,
  getRifleAmmoGraphic,
} from './SupplyItemGraphics';

export type SupplyItemType =
  | 'health_pack'
  | 'frag_grenade'
  | 'bazooka'
  | 'akm'
  | 'm4'
  | 'magazine_upgrade'
  | 'sniper_ammo'
  | 'rifle_ammo';

export interface SupplyCardOption {
  id: string;
  type: SupplyItemType;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  statBonus: string;
  graphicSvg: string;
}

export interface SupplyLoadoutState {
  hasBazooka: boolean;
  hasAkm: boolean;
  hasM4: boolean;
  currentHp: number;
  maxHp: number;
  grenadeCount?: number;
}

export class SupplySelectionModal {
  private readonly modalEl: HTMLElement | null;
  private readonly titleEl: HTMLElement | null;
  private readonly subtitleEl: HTMLElement | null;
  private readonly containerEl: HTMLElement | null;
  private readonly footerEl: HTMLElement | null;
  private readonly timerSecondsEl: HTMLElement | null;
  private readonly timerFillEl: HTMLElement | null;

  private isOpen: boolean = false;
  private picksRemaining: number = 1;
  private totalPicksAllowed: number = 1;
  private onClaimCallback?: (type: SupplyItemType, optionTitle: string) => void;
  private onCloseCallback?: () => void;
  private closeTimeout: number | null = null;

  constructor() {
    this.modalEl = document.querySelector<HTMLElement>('#supply-modal');
    this.titleEl = document.querySelector<HTMLElement>('#supply-modal-title');
    this.subtitleEl = document.querySelector<HTMLElement>('#supply-modal-subtitle');
    this.containerEl = document.querySelector<HTMLElement>('#supply-cards-container');
    this.footerEl = document.querySelector<HTMLElement>('#supply-picks-remaining');
    this.timerSecondsEl = document.querySelector<HTMLElement>('#supply-modal-timer-seconds');
    this.timerFillEl = document.querySelector<HTMLElement>('#supply-modal-timer-fill');

    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          this.close();
        }
      });
    }
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Opens the tactical supply selection modal with dynamically balanced item choices.
   *
   * Supply Claim Rules:
   * 1. Wave 1 to Wave 4: 1 item
   * 2. Wave 5 to Wave 9: 2 items
   * 3. Wave 10+: 3 items
   */
  public open(
    waveNumber: number,
    isBossWave: boolean,
    loadout: SupplyLoadoutState,
    onClaim: (type: SupplyItemType, optionTitle: string) => void,
    onClose?: () => void
  ): void {
    if (!this.modalEl || !this.containerEl) return;

    this.isOpen = true;
    this.onClaimCallback = onClaim;
    this.onCloseCallback = onClose;

    if (this.closeTimeout !== null) {
      window.clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    // Set allowed claim picks based on wave progression rules
    if (waveNumber <= 4) {
      this.picksRemaining = 1;
    } else if (waveNumber <= 9) {
      this.picksRemaining = 2;
    } else {
      this.picksRemaining = 3;
    }
    this.totalPicksAllowed = this.picksRemaining;

    if (this.titleEl) {
      this.titleEl.textContent = isBossWave
        ? `⭐ WARLORD AIRDROP — WAVE ${waveNumber} CLEARED`
        : `📦 SUPPLIES CRATE — WAVE ${waveNumber} CLEARED`;
      this.titleEl.style.color = isBossWave ? '#e3b341' : '#58a6ff';
    }

    if (this.subtitleEl) {
      this.subtitleEl.textContent = `PILIH ${this.picksRemaining} ITEM DARI SUPPLIES (WAKTU BERJALAN!)`;
    }

    this.updatePicksDisplay();

    // Generate balanced options suited to wave progression and equipment status
    const options = this.generateOptions(waveNumber, isBossWave, loadout);
    this.renderCards(options);

    this.modalEl.style.display = 'flex';
  }

  /**
   * Updates real-time timer countdown while modal is open.
   */
  public updateTimer(secondsRemaining: number, totalDuration: number = 7.0): void {
    if (!this.isOpen) return;

    const clampedSec = Math.max(0, secondsRemaining);
    if (this.timerSecondsEl) {
      this.timerSecondsEl.textContent = `${clampedSec.toFixed(1)}s`;
    }

    if (this.timerFillEl && totalDuration > 0) {
      const pct = Math.max(0, Math.min(100, (clampedSec / totalDuration) * 100));
      this.timerFillEl.style.width = `${pct}%`;
      if (pct < 30) {
        this.timerFillEl.style.background = '#f85149';
      } else if (pct < 60) {
        this.timerFillEl.style.background = '#d29922';
      } else {
        this.timerFillEl.style.background = 'linear-gradient(90deg, #388bfd, #2ea043)';
      }
    }

    if (clampedSec <= 0) {
      this.close();
    }
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.closeTimeout !== null) {
      window.clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  private updatePicksDisplay(): void {
    if (this.footerEl) {
      this.footerEl.textContent = `Sisa Pilihan Item: ${this.picksRemaining} / ${this.totalPicksAllowed}`;
      this.footerEl.style.color = this.picksRemaining > 1 ? '#e3b341' : '#58a6ff';
    }
  }

  private generateOptions(
    waveNumber: number,
    isBossWave: boolean,
    loadout: SupplyLoadoutState
  ): SupplyCardOption[] {
    const list: SupplyCardOption[] = [];

    // 1. Health Recovery (IFAK First Aid Kit)
    const healAmount = isBossWave ? 100 : 45;
    list.push({
      id: 'opt-health',
      type: 'health_pack',
      title: isBossWave ? 'Trauma Medkit IFAK' : 'First Aid Medical Kit',
      badge: 'MEDIS',
      badgeColor: '#2ea043',
      description: isBossWave
        ? 'Pemulihan darurat vital signs 100% dan perbaikan plat pelindung.'
        : 'Perban taktis hemostatik untuk memulihkan vital signs +45 HP.',
      graphicSvg: getHealthPackGraphic(),
      statBonus: `+${healAmount} HP`,
    });

    // 2. Heavy Weapon / Explosive (Bazooka RPG-7)
    if (!loadout.hasBazooka) {
      list.push({
        id: 'opt-bazooka-unlock',
        type: 'bazooka',
        title: 'RPG-7 Rocket Launcher',
        badge: 'SENJATA BARU',
        badgeColor: '#f0883e',
        description: 'Peluncur roket penghancur armor dengan daya ledak area masif (Tombol 3).',
        graphicSvg: getBazookaGraphic(),
        statBonus: 'UNLOCK [3] + 3 Roket',
      });
    } else {
      list.push({
        id: 'opt-bazooka-ammo',
        type: 'bazooka',
        title: 'Roket PG-7V Heavy',
        badge: 'EXPLOSIVE',
        badgeColor: '#f0883e',
        description: 'Isi ulang amunisi hulu ledak anti-armor berdaya rusak tinggi.',
        graphicSvg: getBazookaGraphic(),
        statBonus: '+3 Roket',
      });
    }

    // 3. Assault Rifle Option (AKM or M4)
    if (!loadout.hasAkm) {
      list.push({
        id: 'opt-akm-unlock',
        type: 'akm',
        title: 'AKM 7.62x39mm Rifle',
        badge: 'SENJATA BARU',
        badgeColor: '#d29922',
        description: 'Senapan serbu kaliber berat dengan penetrasi dan damage tinggi (Tombol 4).',
        graphicSvg: getAkmGraphic(),
        statBonus: 'UNLOCK [4] + 60 Peluru',
      });
    } else if (!loadout.hasM4) {
      list.push({
        id: 'opt-m4-unlock',
        type: 'm4',
        title: 'M4 Carbine 5.56mm NATO',
        badge: 'SENJATA BARU',
        badgeColor: '#58a6ff',
        description: 'Senapan serbu akurasi tinggi dengan fire rate cepat dan recoil stabil (Tombol 5).',
        graphicSvg: getM4Graphic(),
        statBonus: 'UNLOCK [5] + 90 Peluru',
      });
    } else {
      // Both unlocked: offer rifle ammo
      list.push({
        id: 'opt-rifle-ammo',
        type: 'rifle_ammo',
        title: 'Peti Amunisi Senapan',
        badge: 'AMUNISI',
        badgeColor: '#58a6ff',
        description: 'Kotak amunisi militer kaliber 7.62mm dan 5.56mm untuk AKM dan M4.',
        graphicSvg: getRifleAmmoGraphic(),
        statBonus: '+60 AKM / +90 M4 Peluru',
      });
    }

    // 4. Tactical Bombs or Magazine Upgrade
    if (waveNumber % 2 === 0 || isBossWave) {
      list.push({
        id: 'opt-magazine',
        type: 'magazine_upgrade',
        title: 'Drum Magazine 75-Rounds',
        badge: 'UPGRADE MAG',
        badgeColor: '#bc8cff',
        description: 'Upgrade kapasitas magazine permanen agar siap tembak lebih banyak tanpa sering reload.',
        graphicSvg: getMagazineUpgradeGraphic(),
        statBonus: '+2 Sniper / +10 Rifle Mag',
      });
    } else {
      list.push({
        id: 'opt-grenade',
        type: 'frag_grenade',
        title: 'Bom Granat Frag M67',
        badge: 'TAKTIS',
        badgeColor: '#f85149',
        description: 'Granat lempar berdaya ledak fragmentasi baja mematikan dalam radius 6m (Tombol G).',
        graphicSvg: getGrenadeGraphic(),
        statBonus: '+2 Bom Granat',
      });
    }

    // 5. Sniper Ammo (Match Grade Lapua Magnum)
    list.push({
      id: 'opt-sniper-ammo',
      type: 'sniper_ammo',
      title: 'Peluru Sniper .338 Lapua',
      badge: 'AMUNISI SNIPER',
      badgeColor: '#388bfd',
      description: 'Amunisi presisi armor-piercing kecepatan tinggi untuk senapan runduk AWM.',
      graphicSvg: getSniperAmmoGraphic(),
      statBonus: '+25 Peluru Sniper',
    });

    return list;
  }

  private renderCards(options: SupplyCardOption[]): void {
    const containerEl = this.containerEl;
    if (!containerEl) return;
    
    containerEl.innerHTML = '';

    options.forEach((opt) => {
      const card = document.createElement('div');
      card.className = 'supply-card';
      card.innerHTML = `
        <div class="supply-card-badge" style="background: ${opt.badgeColor}22; color: ${opt.badgeColor}; border: 1px solid ${opt.badgeColor}55;">
          ${opt.badge}
        </div>
        <div class="supply-card-svg">
          ${opt.graphicSvg}
        </div>
        <div class="supply-card-title">${opt.title}</div>
        <div class="supply-card-desc">${opt.description}</div>
        <div class="supply-card-bonus">${opt.statBonus}</div>
        <button class="btn-claim-item">KLAIM ITEM</button>
      `;

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectItem(opt, card);
      });

      containerEl.appendChild(card);
    });
  }

  private selectItem(opt: SupplyCardOption, cardEl: HTMLElement): void {
    if (this.picksRemaining <= 0) return;

    cardEl.classList.add('selected');
    cardEl.style.pointerEvents = 'none';
    cardEl.style.opacity = '0.4';
    cardEl.style.transform = 'scale(0.96)';

    if (this.onClaimCallback) {
      this.onClaimCallback(opt.type, opt.title);
    }

    this.picksRemaining--;
    this.updatePicksDisplay();

    if (this.picksRemaining <= 0) {
      if (this.containerEl) {
        const allCards = this.containerEl.querySelectorAll<HTMLElement>('.supply-card');
        allCards.forEach((c) => {
          c.style.pointerEvents = 'none';
        });
      }
      this.closeTimeout = window.setTimeout(() => {
        this.close();
        this.closeTimeout = null;
      }, 350);
    }
  }

  public dispose(): void {
    this.onClaimCallback = undefined;
    this.onCloseCallback = undefined;
    this.close();
    if (this.containerEl) {
      this.containerEl.innerHTML = '';
    }
  }
}
