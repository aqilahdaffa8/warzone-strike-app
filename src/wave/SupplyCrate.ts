import * as THREE from 'three';

export interface CrateRewardData {
  ammo: number;
  health: number;
  grenades: number;
  rockets: number;
  magazineUpgrade?: number;
  unlockedBazooka?: boolean;
  isBossReward: boolean;
}

export class SupplyCrate {
  public readonly group: THREE.Group;
  public readonly position: THREE.Vector3;
  public readonly isBossCrate: boolean;

  private readonly scene: THREE.Scene;
  private readonly rewardData: CrateRewardData;
  private isClaimed: boolean = false;

  private beaconMesh: THREE.Mesh;
  private floatingPrompt: THREE.Sprite;
  private beaconLight: THREE.PointLight;
  private rotationAngle: number = 0;

  constructor(
    position: THREE.Vector3,
    rewardData: CrateRewardData,
    scene: THREE.Scene
  ) {
    this.scene = scene;
    this.rewardData = rewardData;
    this.isBossCrate = rewardData.isBossReward;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.position = this.group.position;

    // 1. Military Supply Crate Body (Olive or Obsidian for Boss)
    const crateMat = new THREE.MeshStandardMaterial({
      color: this.isBossCrate ? 0x221818 : 0x2d3a29, // Obsidian red for boss crate, olive for standard
      roughness: 0.6,
      metalness: 0.4,
    });

    const crateGeo = new THREE.BoxGeometry(1.2, 0.65, 0.8);
    const crateMesh = new THREE.Mesh(crateGeo, crateMat);
    crateMesh.position.y = 0.325;
    crateMesh.castShadow = true;
    crateMesh.receiveShadow = true;
    this.group.add(crateMesh);

    // Hazard Stripes & Steel Reinforcement Straps
    const strapMat = new THREE.MeshStandardMaterial({
      color: this.isBossCrate ? 0xd4af37 : 0xe3b341, // Gold / Yellow hazard
      roughness: 0.4,
      metalness: 0.8,
    });
    const strapGeo = new THREE.BoxGeometry(0.12, 0.67, 0.82);
    const s1 = new THREE.Mesh(strapGeo, strapMat);
    s1.position.set(-0.35, 0.325, 0);
    this.group.add(s1);

    const s2 = new THREE.Mesh(strapGeo, strapMat);
    s2.position.set(0.35, 0.325, 0);
    this.group.add(s2);

    // 2. Vertical Beacon Light Pillar (Skyward light column so player easily spots it)
    const beaconColor = this.isBossCrate ? 0xffaa00 : 0x388bfd;
    const beaconGeo = new THREE.CylinderGeometry(0.06, 0.06, 16, 8);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: beaconColor,
      transparent: true,
      opacity: 0.45,
    });
    this.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.beaconMesh.position.set(0, 8, 0);
    this.group.add(this.beaconMesh);

    // PointLight at crate
    this.beaconLight = new THREE.PointLight(beaconColor, 3, 10);
    this.beaconLight.position.set(0, 1.2, 0);
    this.group.add(this.beaconLight);

    // 3. Floating 3D Text Prompt Sprite ("[E] CLAIM SUPPLIES")
    this.floatingPrompt = this.createPromptSprite();
    this.floatingPrompt.position.set(0, 1.35, 0);
    this.group.add(this.floatingPrompt);

    this.scene.add(this.group);
  }

  private createPromptSprite(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
      const ctxAny = ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
      if (typeof ctxAny.roundRect === 'function') {
        ctxAny.roundRect(0, 0, 380, 90, 16);
      } else {
        ctx.fillRect(0, 0, 380, 90);
      }
      ctx.fill();

      ctx.strokeStyle = this.isBossCrate ? '#d4af37' : '#58a6ff';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.isBossCrate ? '⭐ WARLORD REWARD [E]' : '📦 CLAIM SUPPLIES [E]', 190, 42);

      ctx.fillStyle = this.isBossCrate ? '#e3b341' : '#3fb950';
      ctx.font = 'bold 20px monospace';
      const magText = this.rewardData.magazineUpgrade ? ` | +${this.rewardData.magazineUpgrade} MAG` : '';
      const weaponText = this.rewardData.unlockedBazooka
        ? '💥 RPG-7 UNLOCKED!'
        : `+${this.rewardData.rockets} RCKT`;
      ctx.fillText(
        `${weaponText} | +${this.rewardData.ammo} AMMO | +${this.rewardData.health} HP${magText}`,
        190,
        74
      );
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  public getIsClaimed(): boolean {
    return this.isClaimed;
  }

  public getRewardData(): CrateRewardData {
    return this.rewardData;
  }

  public update(dt: number, playerPos: THREE.Vector3): boolean {
    if (this.isClaimed) return false;

    this.rotationAngle += dt * 2.0;

    // Bobbing & pulsing light effect
    this.floatingPrompt.position.y = 1.35 + Math.sin(this.rotationAngle) * 0.08;
    this.beaconLight.intensity = 2.5 + Math.sin(this.rotationAngle * 2.5) * 1.0;

    // Check proximity touch (within 2.2 meters auto-allows claim)
    const distToPlayer = this.position.distanceTo(playerPos);
    return distToPlayer <= 2.2;
  }

  public claim(): CrateRewardData | null {
    if (this.isClaimed) return null;
    this.isClaimed = true;

    // Clean up 3D objects
    this.dispose();
    return this.rewardData;
  }

  public dispose(): void {
    this.scene.remove(this.group);
    this.floatingPrompt.material.dispose();
    if (this.floatingPrompt.material.map) {
      this.floatingPrompt.material.map.dispose();
    }
    this.beaconMesh.geometry.dispose();
    (this.beaconMesh.material as THREE.Material).dispose();
  }
}
