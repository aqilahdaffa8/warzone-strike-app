import * as THREE from 'three';

export interface ArenaObstacle {
  id: string;
  mesh: THREE.Mesh;
}

export class Arena {
  public readonly group: THREE.Group;
  public readonly obstacles: ArenaObstacle[] = [];
  private colliders: THREE.Box3[] | null = null;
  private groundMesh!: THREE.Mesh;
  private raycastObstacleList: THREE.Mesh[] | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.buildArena();
  }

  /**
   * Returns pre-computed AABB bounding boxes of all arena obstacles.
   */
  public getColliders(): THREE.Box3[] {
    if (!this.colliders) {
      this.colliders = [];
      this.group.updateMatrixWorld(true);
      for (const obstacle of this.obstacles) {
        obstacle.mesh.updateWorldMatrix(true, false);
        const box = new THREE.Box3().setFromObject(obstacle.mesh);
        this.colliders.push(box);
      }
    }
    return this.colliders;
  }

  /**
   * Returns all physical meshes (including walls, obstacles, and ground)
   * for bullet raycast line-of-sight and penetration testing.
   */
  public getRaycastObstacles(): THREE.Mesh[] {
    if (!this.raycastObstacleList) {
      this.raycastObstacleList = [this.groundMesh, ...this.obstacles.map((o) => o.mesh)];
    }
    return this.raycastObstacleList;
  }

  private buildArena(): void {
    // Shared materials
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.85,
      metalness: 0.1,
    });

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d444d,
      roughness: 0.7,
      metalness: 0.25,
    });

    const containerMatGreen = new THREE.MeshStandardMaterial({
      color: 0x2e4c38,
      roughness: 0.6,
      metalness: 0.3,
    });

    const containerMatBlue = new THREE.MeshStandardMaterial({
      color: 0x2c435c,
      roughness: 0.6,
      metalness: 0.3,
    });

    const containerMatRust = new THREE.MeshStandardMaterial({
      color: 0x6e3b2b,
      roughness: 0.8,
      metalness: 0.2,
    });

    const crateMaterial = new THREE.MeshStandardMaterial({
      color: 0x61523f,
      roughness: 0.75,
      metalness: 0.1,
    });

    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a525d,
      roughness: 0.65,
      metalness: 0.2,
    });

    const metalTowerMaterial = new THREE.MeshStandardMaterial({
      color: 0x272e36,
      roughness: 0.5,
      metalness: 0.6,
    });

    // 1. Ground Plane (60 x 60 m, with 0.2m thickness to prevent z-fighting with shadows)
    const groundGeo = new THREE.BoxGeometry(60, 0.4, 60);
    const groundMesh = new THREE.Mesh(groundGeo, groundMaterial);
    groundMesh.position.set(0, -0.2, 0);
    groundMesh.receiveShadow = true;
    this.groundMesh = groundMesh;
    this.group.add(groundMesh);

    // Grid markings / lane stripes on ground
    const gridHelper = new THREE.GridHelper(60, 30, 0x444c56, 0x2d333b);
    gridHelper.position.y = 0.01;
    this.group.add(gridHelper);

    // 2. Perimeter Boundary Walls (height 4m, thickness 1m)
    // Arena is 60x60m centered at (0, 0, 0) -> boundaries at -30 and +30
    this.createWall('wall-north', 0, 2, -30, 60, 4, 1, wallMaterial);
    this.createWall('wall-south', 0, 2, 30, 60, 4, 1, wallMaterial);
    this.createWall('wall-east', 30, 2, 0, 1, 4, 60, wallMaterial);
    this.createWall('wall-west', -30, 2, 0, 1, 4, 60, wallMaterial);

    // 3. Shipping Containers (6m length x 2.6m height x 2.4m width)
    this.createContainer('container-1', -14, 1.3, -12, 6, 2.6, 2.4, 0, containerMatGreen);
    this.createContainer('container-2', -14, 3.9, -12, 6, 2.6, 2.4, 0, containerMatRust); // Stacked
    this.createContainer('container-3', 16, 1.3, -14, 6, 2.6, 2.4, Math.PI / 5, containerMatBlue);
    this.createContainer('container-4', -16, 1.3, 14, 6, 2.6, 2.4, -Math.PI / 4, containerMatRust);
    this.createContainer('container-5', 12, 1.3, 15, 6, 2.6, 2.4, Math.PI / 2, containerMatGreen);
    this.createContainer('container-6', 0, 1.3, -6, 6, 2.6, 2.4, -Math.PI / 12, containerMatBlue);

    // 4. Crates / Cargo Boxes
    this.createBox('crate-1', -8, 0.75, -8, 1.5, 1.5, 1.5, 0.1, crateMaterial);
    this.createBox('crate-2', -6.5, 0.6, -8.2, 1.2, 1.2, 1.2, -0.2, crateMaterial);
    this.createBox('crate-3', 8, 1.0, -10, 2.0, 2.0, 2.0, 0.3, crateMaterial);
    this.createBox('crate-4', 9.5, 0.6, -9.8, 1.2, 1.2, 1.2, 0, crateMaterial);
    this.createBox('crate-5', -6, 0.75, 8, 1.5, 1.5, 1.5, -0.4, crateMaterial);
    this.createBox('crate-6', 6, 0.75, 8, 1.5, 1.5, 1.5, 0.5, crateMaterial);
    this.createBox('crate-7', 7.5, 0.5, 7.8, 1.0, 1.0, 1.0, 0.1, crateMaterial);

    // 5. Concrete Barriers / Tactical Covers (3m x 1m x 0.8m)
    this.createBox('barrier-1', 0, 0.5, 6, 4, 1, 0.8, 0, barrierMaterial);
    this.createBox('barrier-2', -8, 0.5, 0, 0.8, 1, 3.5, 0, barrierMaterial);
    this.createBox('barrier-3', 8, 0.5, 0, 0.8, 1, 3.5, 0, barrierMaterial);
    this.createBox('barrier-4', -20, 0.5, -4, 3, 1, 0.8, Math.PI / 3, barrierMaterial);
    this.createBox('barrier-5', 20, 0.5, 6, 3, 1, 0.8, -Math.PI / 4, barrierMaterial);

    // 6. Observation / Watchtower Platform Placeholder (at corner -22, -22)
    this.createWatchtower(-22, -22, metalTowerMaterial);
  }

  private createWall(
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material
  ): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.obstacles.push({ id, mesh });
  }

  private createContainer(
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotY: number,
    material: THREE.Material
  ): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.obstacles.push({ id, mesh });
  }

  private createBox(
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotY: number,
    material: THREE.Material
  ): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.obstacles.push({ id, mesh });
  }

  private createWatchtower(x: number, z: number, material: THREE.Material): void {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(x, 0, z);

    // 4 legs
    const legGeo = new THREE.BoxGeometry(0.3, 5, 0.3);
    const offsets = [
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ];

    for (let i = 0; i < offsets.length; i++) {
      const [ox, oz] = offsets[i];
      const leg = new THREE.Mesh(legGeo, material);
      leg.position.set(ox, 2.5, oz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      towerGroup.add(leg);
      this.obstacles.push({ id: `watchtower-leg-${i + 1}`, mesh: leg });
    }

    // Platform
    const platformGeo = new THREE.BoxGeometry(4.8, 0.3, 4.8);
    const platform = new THREE.Mesh(platformGeo, material);
    platform.position.set(0, 5, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    towerGroup.add(platform);

    // Low railings
    const railingGeoX = new THREE.BoxGeometry(4.8, 0.8, 0.2);
    const railingGeoZ = new THREE.BoxGeometry(0.2, 0.8, 4.8);

    const r1 = new THREE.Mesh(railingGeoX, material);
    r1.position.set(0, 5.5, 2.3);
    towerGroup.add(r1);

    const r2 = new THREE.Mesh(railingGeoX, material);
    r2.position.set(0, 5.5, -2.3);
    towerGroup.add(r2);

    const r3 = new THREE.Mesh(railingGeoZ, material);
    r3.position.set(2.3, 5.5, 0);
    towerGroup.add(r3);

    const r4 = new THREE.Mesh(railingGeoZ, material);
    r4.position.set(-2.3, 5.5, 0);
    towerGroup.add(r4);

    this.group.add(towerGroup);
  }
}
