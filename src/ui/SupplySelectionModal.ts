import {
  getAkmGraphic,
  getM4Graphic,
  getBazookaGraphic,
  getHealthPackGraphic,
  getGrenadeGraphic,
  getMagazineUpgradeGraphic,
  getSniperAmmoGraphic,
  getSniperRifleGraphic,
  getRifleAmmoGraphic,
  getReloadUpgradeGraphic,
  getDamageUpgradeGraphic,
  getMaxHpUpgradeGraphic,
} from './SupplyItemGraphics';
import { UPGRADE_CONFIG, UpgradeKind, UpgradeSteps } from '../config/upgradeConfig';
import type { WeaponType } from '../weapons/Weapon';

export type SupplyItemType =
  | 'health_pack'
  | 'frag_grenade'
  | 'bazooka'
  | 'akm'
  | 'm4'
  | 'sniper_rifle'
  | 'magazine_upgrade'
  | 'sniper_ammo'
  | 'rifle_ammo'
  | 'akm_ammo'
  | 'm4_ammo'
  | 'rpg_ammo'
  | 'reload_upgrade'
  | 'damage_upgrade'
  | 'max_hp_upgrade';

export type PrimaryWeaponId = 'sniper' | 'akm' | 'm4';

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
  primaryWeapon: PrimaryWeaponId;
  /** Weapon currently held by the player (decides which ammo card is offered). */
  activeWeapon: WeaponType;
  upgradeSteps: UpgradeSteps;
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
  private onCloseCallback?: (reason: 'claimed' | 'expired' | 'cancelled') => void;
  private closeTimeout: number | null = null;
  private selectionTimeRemaining: number = 0;
  private selectionDuration: number = 10;

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
          this.close('cancelled');
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
    onClose?: (reason: 'claimed' | 'expired' | 'cancelled') => void,
    selectionDuration: number = 10
  ): void {
    if (!this.modalEl || !this.containerEl) return;

    this.isOpen = true;
    this.onClaimCallback = onClaim;
    this.onCloseCallback = onClose;
    this.selectionDuration = Math.max(0.1, selectionDuration);
    this.selectionTimeRemaining = this.selectionDuration;

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
      this.subtitleEl.textContent = `PILIH ${this.picksRemaining} ITEM DARI SUPPLIES`;
    }

    this.updatePicksDisplay();

    // Generate balanced options suited to wave progression and equipment status
    const options = this.generateOptions(waveNumber, isBossWave, loadout);
    this.renderCards(options);

    this.modalEl.style.display = 'flex';
  }

  /**
   * Updates the visible 10-second selection timer after the crate has been opened.
   * The crate's separate pre-interaction lifetime remains hidden.
   */
  public update(dt: number): void {
    if (!this.isOpen) return;

    this.selectionTimeRemaining = Math.max(0, this.selectionTimeRemaining - dt);
    if (this.timerSecondsEl) {
      this.timerSecondsEl.textContent = `${this.selectionTimeRemaining.toFixed(1)}s`;
    }

    if (this.timerFillEl && this.selectionDuration > 0) {
      const pct = Math.max(0, Math.min(100, (this.selectionTimeRemaining / this.selectionDuration) * 100));
      this.timerFillEl.style.width = `${pct}%`;
    }

    if (this.selectionTimeRemaining <= 0) {
      this.close('expired');
    }
  }

  public close(reason: 'claimed' | 'expired' | 'cancelled' = 'cancelled'): void {
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
      this.onCloseCallback(reason);
    }
  }

  private updatePicksDisplay(): void {
    if (this.footerEl) {
      this.footerEl.textContent = `Sisa Pilihan Item: ${this.picksRemaining} / ${this.totalPicksAllowed}`;
      this.footerEl.style.color = this.picksRemaining > 1 ? '#e3b341' : '#58a6ff';
    }
  }

  /**
   * Builds the 5 supply cards. Layout (each slot is randomised where noted):
   *  1. Health (always offered)
   *  2. Ammo for the weapon currently HELD (RPG rockets if the RPG is held, else the primary weapon)
   *  3. Weapon slot: random of RPG-7 (if not owned) / Sniper / AKM / M4, excluding the current primary
   *     (falls back to an extra upgrade when nothing is left to offer)
   *  4. Utility: random of grenade / magazine upgrade
   *  5. Permanent upgrade: random of reload / damage / max HP (until capped)
   */
  private generateOptions(
    waveNumber: number,
    isBossWave: boolean,
    loadout: SupplyLoadoutState
  ): SupplyCardOption[] {
    void waveNumber;
    const list: SupplyCardOption[] = [];

    // 1. Health: always available
    list.push(this.buildHealthCard(isBossWave));

    // 2. Ammo for the weapon the player is actually holding
    if (loadout.activeWeapon === 'bazooka' && loadout.hasBazooka) {
      list.push(this.buildRpgAmmoCard());
    } else {
      list.push(this.buildPrimaryAmmoCard(loadout.primaryWeapon));
    }

    // Upgrade pool (only kinds that are not capped yet)
    const upgradePool: UpgradeKind[] = (['reload', 'damage', 'maxHp'] as UpgradeKind[]).filter(
      (kind) => loadout.upgradeSteps[kind] < UPGRADE_CONFIG[kind].maxSteps
    );

    // 3. Weapon slot
    const weaponPool: Array<'bazooka' | 'sniper' | 'akm' | 'm4'> = [];
    if (!loadout.hasBazooka) weaponPool.push('bazooka');
    if (loadout.primaryWeapon !== 'sniper') weaponPool.push('sniper');
    if (loadout.primaryWeapon !== 'akm') weaponPool.push('akm');
    if (loadout.primaryWeapon !== 'm4') weaponPool.push('m4');

    const weaponKind = this.takeRandom(weaponPool);
    if (weaponKind) {
      list.push(this.buildWeaponCard(weaponKind, loadout));
    } else {
      const extra = this.takeRandom(upgradePool);
      if (extra) list.push(this.buildUpgradeCard(extra, isBossWave, loadout.upgradeSteps));
    }

    // 4. Utility
    const utilityPool: Array<'frag_grenade' | 'magazine_upgrade'> = ['frag_grenade', 'magazine_upgrade'];
    const utilityKind = this.takeRandom(utilityPool);
    if (utilityKind) list.push(this.buildUtilityCard(utilityKind, isBossWave));

    // 5. Permanent upgrade
    const upgradeKind = this.takeRandom(upgradePool);
    if (upgradeKind) {
      list.push(this.buildUpgradeCard(upgradeKind, isBossWave, loadout.upgradeSteps));
    } else {
      // Every upgrade is capped: fall back to a second utility card.
      const fallback = this.takeRandom(utilityPool);
      if (fallback) list.push(this.buildUtilityCard(fallback, isBossWave));
    }

    return list;
  }

  /** Removes and returns a random element (undefined when the array is empty). */
  private takeRandom<T>(pool: T[]): T | undefined {
    if (pool.length === 0) return undefined;
    const index = Math.floor(Math.random() * pool.length);
    return pool.splice(index, 1)[0];
  }

  private buildHealthCard(isBossWave: boolean): SupplyCardOption {
    const healAmount = isBossWave ? 100 : 45;
    return {
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
    };
  }

  private buildPrimaryAmmoCard(primary: PrimaryWeaponId): SupplyCardOption {
    if (primary === 'akm') {
      return {
        id: 'opt-akm-ammo',
        type: 'akm_ammo',
        title: 'Peti Amunisi AKM 7.62mm',
        badge: 'AMUNISI',
        badgeColor: '#d29922',
        description: 'Kotak amunisi 7.62x39mm untuk senapan serbu AKM yang sedang Anda pakai.',
        graphicSvg: getRifleAmmoGraphic(),
        statBonus: '+60 Peluru AKM',
      };
    }
    if (primary === 'm4') {
      return {
        id: 'opt-m4-ammo',
        type: 'm4_ammo',
        title: 'Peti Amunisi M4 5.56mm',
        badge: 'AMUNISI',
        badgeColor: '#58a6ff',
        description: 'Kotak amunisi 5.56x45mm NATO untuk M4 Carbine yang sedang Anda pakai.',
        graphicSvg: getRifleAmmoGraphic(),
        statBonus: '+90 Peluru M4',
      };
    }
    return {
      id: 'opt-sniper-ammo',
      type: 'sniper_ammo',
      title: 'Peluru Sniper .338 Lapua',
      badge: 'AMUNISI SNIPER',
      badgeColor: '#388bfd',
      description: 'Amunisi presisi armor-piercing kecepatan tinggi untuk senapan runduk AWM.',
      graphicSvg: getSniperAmmoGraphic(),
      statBonus: '+25 Peluru Sniper',
    };
  }

  private buildWeaponCard(
    kind: 'bazooka' | 'sniper' | 'akm' | 'm4',
    loadout: SupplyLoadoutState
  ): SupplyCardOption {
    if (kind === 'sniper') {
      return {
        id: 'opt-sniper-swap',
        type: 'sniper_rifle',
        title: 'AWM Sniper Rifle',
        badge: 'GANTI SENJATA',
        badgeColor: '#388bfd',
        description: 'Kembali ke senapan runduk bolt-action dengan scope (Ganti Senjata Utama Slot 1).',
        graphicSvg: getSniperRifleGraphic(),
        statBonus: 'SLOT 1 + 25 Peluru',
      };
    }
    if (kind === 'bazooka') {
      return {
        id: 'opt-bazooka-unlock',
        type: 'bazooka',
        title: 'RPG-7 Rocket Launcher',
        badge: 'SENJATA BARU',
        badgeColor: '#f0883e',
        description: 'Peluncur roket penghancur armor dengan daya ledak area masif (Tombol 3).',
        graphicSvg: getBazookaGraphic(),
        statBonus: 'UNLOCK [3] + 3 Roket',
      };
    }
    if (kind === 'akm') {
      return {
        id: 'opt-akm-unlock',
        type: 'akm',
        title: 'AKM 7.62x39mm Rifle',
        badge: loadout.hasAkm ? 'GANTI SENJATA' : 'SENJATA BARU',
        badgeColor: '#d29922',
        description: 'Senapan serbu kaliber berat dengan penetrasi dan damage tinggi (Ganti Senjata Utama Slot 1).',
        graphicSvg: getAkmGraphic(),
        statBonus: 'SLOT 1 + 60 Peluru',
      };
    }
    return {
      id: 'opt-m4-unlock',
      type: 'm4',
      title: 'M4 Carbine 5.56mm NATO',
      badge: loadout.hasM4 ? 'GANTI SENJATA' : 'SENJATA BARU',
      badgeColor: '#58a6ff',
      description: 'Senapan serbu akurasi tinggi dengan fire rate cepat dan recoil stabil (Ganti Senjata Utama Slot 1).',
      graphicSvg: getM4Graphic(),
      statBonus: 'SLOT 1 + 90 Peluru',
    };
  }

  private buildRpgAmmoCard(): SupplyCardOption {
    return {
      id: 'opt-bazooka-ammo',
      type: 'rpg_ammo',
      title: 'Roket PG-7V Heavy',
      badge: 'AMUNISI RPG',
      badgeColor: '#f0883e',
      description: 'Isi ulang amunisi hulu ledak anti-armor berdaya rusak tinggi untuk RPG-7 yang sedang Anda pegang.',
      graphicSvg: getBazookaGraphic(),
      statBonus: '+3 Roket',
    };
  }

  private buildUtilityCard(
    kind: 'frag_grenade' | 'magazine_upgrade',
    isBossWave: boolean
  ): SupplyCardOption {
    if (kind === 'magazine_upgrade') {
      return {
        id: 'opt-magazine',
        type: 'magazine_upgrade',
        title: 'Drum Magazine 75-Rounds',
        badge: 'UPGRADE MAG',
        badgeColor: '#bc8cff',
        description: 'Upgrade kapasitas magazine permanen agar siap tembak lebih banyak tanpa sering reload.',
        graphicSvg: getMagazineUpgradeGraphic(),
        statBonus: '+2 Sniper / +10 Rifle Mag',
      };
    }
    return {
      id: 'opt-grenade',
      type: 'frag_grenade',
      title: 'Bom Granat Frag M67',
      badge: 'TAKTIS',
      badgeColor: '#f85149',
      description: 'Granat lempar berdaya ledak fragmentasi baja mematikan dalam radius 6m (Tombol G).',
      graphicSvg: getGrenadeGraphic(),
      statBonus: isBossWave ? '+3 Bom Granat' : '+2 Bom Granat',
    };
  }

  private buildUpgradeCard(
    kind: UpgradeKind,
    isBossWave: boolean,
    steps: UpgradeSteps
  ): SupplyCardOption {
    const cfg = UPGRADE_CONFIG[kind];
    const gain = Math.min(
      isBossWave ? UPGRADE_CONFIG.bossSteps : UPGRADE_CONFIG.normalSteps,
      cfg.maxSteps - steps[kind]
    );
    const levelText = `Lv ${steps[kind]} → ${steps[kind] + gain} / ${cfg.maxSteps}`;
    const badge = isBossWave ? 'PERMANEN ★ LANGKA' : 'UPGRADE PERMANEN';
    const badgeColor = '#e3b341';

    if (kind === 'reload') {
      return {
        id: 'opt-upgrade-reload',
        type: 'reload_upgrade',
        title: 'Speed Loader Taktis',
        badge,
        badgeColor,
        description: 'Latihan dan perlengkapan reload cepat. Waktu reload semua senjata berkurang secara permanen.',
        graphicSvg: getReloadUpgradeGraphic(),
        statBonus: `+${Math.round(gain * cfg.perStep * 100)}% KECEPATAN RELOAD (${levelText})`,
      };
    }
    if (kind === 'damage') {
      return {
        id: 'opt-upgrade-damage',
        type: 'damage_upgrade',
        title: 'Peluru Armor-Piercing',
        badge,
        badgeColor,
        description: 'Amunisi berinti baja. Damage semua senjata api dan RPG naik secara permanen.',
        graphicSvg: getDamageUpgradeGraphic(),
        statBonus: `+${Math.round(gain * cfg.perStep * 100)}% DAMAGE (${levelText})`,
      };
    }
    return {
      id: 'opt-upgrade-maxhp',
      type: 'max_hp_upgrade',
      title: 'Plat Armor Tambahan',
      badge,
      badgeColor,
      description: 'Plat keramik tambahan. HP maksimum naik secara permanen dan langsung terisi sebesar penambahannya.',
      graphicSvg: getMaxHpUpgradeGraphic(),
      statBonus: `+${gain * cfg.perStep} MAX HP (${levelText})`,
    };
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
        this.close('claimed');
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
