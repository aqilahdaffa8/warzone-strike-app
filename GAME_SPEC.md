# GAME_SPEC.md — Warzone Strike

Spesifikasi apa yang dibangun. Aturan cara kerja ada di `AGENTS.md`, urutan pengerjaan ada di `ROADMAP.md`.

Tanda **[TENTATIVE]** berarti nilai sementara untuk playtesting. **Semua angka HP, damage, ammo, speed, score, dan scaling di dokumen ini adalah temporary playtest defaults, bukan requirement final** dan bukan spesifikasi dari panitia. Letakkan di config, bukan hard-code, dan boleh diubah kapan saja setelah playtesting.

---

## 1. Identitas

| Item | Nilai |
|---|---|
| Nama | Warzone Strike |
| Genre | FPS, Wave Defense / Survival |
| Mode | Single-player |
| Platform dev | Desktop browser |
| Target akhir | Desktop application (Tauri atau Electron, diputuskan setelah web stabil) |

## 2. Konsep

FPS survival bertema sniper. Pemain berada di arena militer dan bertahan dari gelombang musuh tanpa batas. **Tidak ada kondisi menang.** Game berakhir saat health pemain habis.

Tujuan pemain: bertahan selama mungkin, mencapai wave setinggi mungkin, dan mendapatkan score setinggi mungkin.

### Core loop

```text
Main Menu → Masuk Arena → Wave dimulai → Musuh spawn → Pemain bertarung
→ Semua musuh wave selesai → Intermission → Wave berikutnya
   (wave kelipatan 5 → Boss)
→ ... → Health habis → Game Over → Score submission
```

## 3. Scope MVP (dikunci)

Termasuk: 1 arena, 1 jenis enemy, 1 model boss, 2 senjata (sniper + knife), infinite waves, boss tiap wave kelipatan 5, player health, score, headshot, HUD, pause, game over, mock player identity, mock leaderboard, score submission queue, retry submission.

**Tidak termasuk** (jangan dikerjakan kecuali diminta eksplisit): multiplayer, multiple maps, multiple enemy/boss types, inventory, weapon shop, character customization, skill tree, perk, progression kompleks, registrasi/login buatan sendiri, integrasi leaderboard resmi sebelum spesifikasi tersedia, MySQL untuk gameplay, desktop wrapper sebelum web stabil.

## 4. Arena

- Satu arena tertutup sekitar **60 × 60 m**, tema military arena sederhana.
- Elemen: wall, box, container, cover, spawn points. Pada MVP, elemen arena dibuat menggunakan primitive geometry.
- Satu starting position pemain.
- Tower/roof boleh dipertimbangkan sebagai bagian level bila dibutuhkan gameplay, tanpa menambah sistem baru.

### Collision

- Gunakan **AABB sederhana buatan sendiri**. Tanpa physics engine untuk MVP: ini batasan demi kesederhanaan dan stabilitas, **bukan larangan permanen**. Jika kebutuhan gameplay membesar, boleh ditinjau ulang setelah disetujui user.
- Obstacle didefinisikan sebagai daftar AABB (dari `map.json` atau kode arena).
- Pemain sebagai kapsul/silinder yang disederhanakan menjadi AABB atau lingkaran pada bidang XZ; gerakan diselesaikan per-sumbu (axis-separated) agar bisa sliding di dinding.
- Enemy memakai collision yang sama sederhananya (cukup tidak menembus dinding dan tidak menumpuk berlebihan).

## 5. Input dan Player Controller

| Input | Fungsi |
|---|---|
| W / A / S / D | Gerak |
| Mouse | Look / aim |
| Left click | Fire / attack |
| Right click | Scope sniper |
| R | Reload |
| 1 | Sniper |
| 2 | Knife |
| Scroll | Ganti senjata |
| Space | Jump (opsional) |
| Esc | Pause |
| Shift | Sprint dengan stamina terbatas |

Catatan teknis wajib:

- Gunakan **Pointer Lock API** untuk mouse look. Klik pada canvas / tombol Play meminta pointer lock.
- **Esc melepas pointer lock secara otomatis dan tidak dapat dicegat.** Karena itu pause dipicu oleh event `pointerlockchange` (kehilangan lock saat `PLAYING` → masuk `PAUSED`), bukan hanya oleh keydown Esc. Resume meminta pointer lock kembali.
- Cegah menu konteks browser pada canvas (`contextmenu` → `preventDefault`) agar klik kanan untuk scope bekerja.
- Mouse sensitivity dapat diatur (setting sederhana di pause menu atau main menu).
- Perspektif first-person. Pergerakan berbasis delta time.
- Kamera memiliki head-bob ringan hanya saat pemain bergerak dan diam tanpa guncangan.

## 6. Sniper

Senjata utama. Fitur minimum: scope, zoom, ammo terbatas, reload, damage tinggi, headshot bonus, fire rate lambat.

### Sistem tembak (MVP)

```text
Camera → Raycast → cari hit terdekat pada (enemy + obstacle)
   ├── obstacle terdekat → peluru berhenti (tidak menembus dinding)
   └── enemy terdekat
          ├── hitbox Head → headshot (damage × multiplier)
          └── hitbox Body → damage normal
```

- Ray diuji terhadap **enemy dan obstacle**, lalu diambil hit dengan jarak terkecil.
- Tanpa ballistic simulation atau bullet physics.
- Scope: FOV lebih sempit + overlay scope sederhana; sensitivity menyesuaikan zoom.

### Hitbox headshot

Capsule tunggal tidak punya kepala. Enemy placeholder terdiri dari **body (Capsule) + head (Sphere kecil sebagai hitbox terpisah)**. Raycast mengidentifikasi bagian yang kena dari objek/tag hitbox. Logic damage tidak boleh bergantung pada mesh visual final, tetapi pada data hitbox yang bisa dipetakan ulang ke model GLB nanti.

## 7. Knife

- Tanpa ammo, damage sedang, attack cooldown, short-range hit detection (short raycast atau sphere cast).
- Tanpa blade physics.
- Pemain dapat berpindah sniper ↔ knife kapan saja.

## 8. Enemy

Satu jenis enemy biasa. **Tipe serangan: melee** (asumsi MVP; enemy ranged di luar scope).

```text
Spawn → target Player → berjalan menuju Player → masuk attack range
→ Attack (dengan cooldown) → Terima damage → Death
```

- Pathfinding: gerak lurus ke arah pemain dengan penghindaran dinding sederhana. Jangan membuat navmesh kecuali terbukti perlu.
- Enemy tidak boleh spawn terlalu dekat pemain: `minSpawnDistance` di config, dipakai di satu tempat saja.
- Jumlah enemy aktif dibatasi (`maxActiveEnemies` di config). Sisa enemy wave menunggu di antrean spawn.

## 9. Wave System

- Infinite. Wave dimulai setelah intermission; wave berakhir saat semua enemy wave itu mati; berikutnya baru dimulai setelah intermission.
- Scaling minimum: jumlah enemy, enemy HP, enemy damage. Jangan menambah parameter scaling tanpa kebutuhan nyata.
- Semua nilai scaling dapat dituning setelah playtesting.

## 10. Boss

- Muncul di wave 5, 10, 15, 20, ...
- Model/tipe sama tiap kemunculan (scaled enemy placeholder). Perbedaan antar kemunculan: HP naik dan ukuran naik, dengan **size cap**.
- Flow wave boss: enemy biasa → semua mati → boss spawn → boss mati → intermission → wave berikutnya.
- Satu jenis boss saja.

## 11. Score

Sumber score: enemy kill, headshot bonus, boss kill. Jika score sama, wave tertinggi jadi pembeda. Angka bisa dituning.

Statistik yang harus dicatat sepanjang sesi (dibutuhkan payload): `kills`, `headshots`, `bossesKilled`, `shotsFired`, `shotsHit` (untuk `accuracy`), `waveReached`, waktu mulai/selesai (untuk `durationSeconds`).

## 12. Game State

```text
MENU, PLAYING, WAVE_COMPLETE, BOSS, PAUSED, GAME_OVER, SUBMITTING_SCORE, SCORE_SUBMITTED
```

Tidak harus menjadi scene terpisah. Gunakan state machine sederhana di `GameManager`.

## 13. Player Identity

- Tanpa login/register buatan sendiri (endpoint, autentikasi, dan format player ID resmi belum diberikan).
- Gunakan interface `PlayerIdentityProvider` dengan implementasi `MockPlayerIdentityProvider` (temporary `playerId` dan `nickname`). Format mock **bukan** format resmi.
- Provider resmi kelak menggantikan mock tanpa mengubah gameplay.

## 14. Leaderboard dan Score Submission

### Prinsip offline-first (wajib)

- Game **harus dapat dimainkan sepenuhnya tanpa internet** dan tanpa API leaderboard yang aktif: dari Main Menu, bermain, sampai Game Over.
- Leaderboard **bukan dependency gameplay**. API hanya dipakai untuk submission *setelah* game selesai, tidak pernah sebagai syarat memulai game.
- Kegagalan submission (API mati, timeout, offline) tidak boleh memblokir tampilan score akhir, tombol main lagi, atau kembali ke menu. State `SUBMITTING_SCORE` tidak boleh mengunci pemain dari memulai sesi baru.
- Score dibuat menjadi payload dan **disimpan lokal terlebih dahulu**, baru submission dicoba.
- Tidak ada resource runtime dari CDN/URL eksternal; semuanya di-bundle lewat Vite.
- Spesifikasi panitia yang belum tersedia **tidak memblokir development**: pakai abstraction dan mock, tandai integration point.
- `MockLeaderboardClient` harus dapat mensimulasikan sukses, gagal (error), timeout, dan offline/reconnect lewat opsi konfigurasi sederhana, agar failure path bisa diuji.

```text
ScoreManager → LeaderboardClient → MockLeaderboardClient   (sekarang)
ScoreManager → LeaderboardClient → OfficialLeaderboardClient   (nanti)
```

Mengganti implementasi tidak boleh mengubah player controller, weapons, enemy AI, wave, boss, atau logic kalkulasi score.

### Score payload (format internal, BUKAN format resmi panitia)

```json
{
  "gameId": "warzone-strike",
  "playerId": "MOCK-PLAYER-001",
  "nickname": "Budi",
  "sessionId": "uuid-unik",
  "score": 6350,
  "waveReached": 12,
  "bossesKilled": 2,
  "kills": 68,
  "headshots": 25,
  "accuracy": 0.61,
  "durationSeconds": 734,
  "timestamp": "2026-09-30T10:15:00Z"
}
```

### Session ID

Setiap sesi gameplay punya UUID `sessionId` unik (dibuat saat game dimulai). Dipakai untuk membedakan sesi dan mencegah duplicate submission. Nickname tidak boleh dipakai sebagai identitas sesi.

### Submission queue

```text
GAME_OVER → buat ScorePayload → simpan lokal → coba submit
   ├── sukses → hapus dari queue
   └── gagal  → tetap di queue → retry
```

- **Score disimpan lokal sebelum submission dicoba.** Jika submission gagal, timeout, atau jaringan mati, score tetap aman di queue.
- Penyimpanan: **`localStorage`** adalah solusi MVP (data kecil, sederhana). Ini keputusan implementasi, bukan requirement: boleh diganti ke IndexedDB jika kebutuhan membesar, selama tetap di balik `ScoreSubmissionQueue` sehingga penggantian tidak menyentuh gameplay. Jika penulisan storage gagal (quota penuh, mode privat), fallback ke queue di memori dan tampilkan peringatan; jangan crash.
- Retry: strategi awal adalah **manual lewat tombol "Retry"** di Game Over screen ditambah **otomatis satu kali saat game dibuka**; retry saat event `online` boleh ditambahkan. Ini **implementation detail yang dapat disesuaikan**, bukan aturan panitia. Jika spesifikasi resmi kelak mendefinisikan retry contract, ikuti spesifikasi itu. Tanpa retry loop agresif.
- Setiap percobaan submit punya **timeout** (default sementara 10 detik, di config) agar UI tidak menggantung.
- Submit dua kali untuk `sessionId` yang sama harus dicegah di sisi client.

### Backend / MySQL

Bukan dependency MVP. Baru dipertimbangkan setelah spesifikasi leaderboard panitia ada, kebutuhan autentikasi jelas, dan kebutuhan penyimpanan jelas. Arsitektur jika perlu: `Client → Backend API (Node.js + TypeScript + Express) → MySQL`.

## 15. Konfigurasi dan Data

Nilai tuning terpusat, tidak disebar. JSON dipakai hanya untuk data yang memang cocok eksternal (map, weapons, waves).

Nilai awal **[TENTATIVE]** untuk playtesting pertama. Seluruh angka di tabel ini (HP, damage, ammo, speed, score, scaling, timeout) adalah **temporary playtest defaults, bukan requirement final**:

| Kategori | Parameter | Nilai awal |
|---|---|---|
| Player | HP | 100 |
| Player | Kecepatan jalan | 6 m/s |
| Sniper | Damage body | 80 |
| Sniper | Headshot multiplier | 2.5 |
| Sniper | Fire interval | 1.5 s |
| Sniper | Magazine / cadangan | 5 / 30 |
| Sniper | Reload time | 2.5 s |
| Sniper | Zoom (FOV scope) | 20° (FOV normal 75°) |
| Knife | Damage | 35 |
| Knife | Cooldown | 0.6 s |
| Knife | Range | 2 m |
| Enemy | HP | 100 |
| Enemy | Damage per serangan | 10 |
| Enemy | Attack range / cooldown | 2 m / 1 s |
| Enemy | Kecepatan | 3.5 m/s |
| Wave | Jumlah enemy wave 1 | 5 |
| Wave | Tambahan enemy per wave | +2 |
| Wave | Scaling HP / damage | +10% / +5% per wave |
| Wave | Intermission | 5 s |
| Spawn | Min distance dari pemain | 20 m |
| Spawn | Max enemy aktif | 15 |
| Boss | HP dasar | 1000, +50% per kemunculan |
| Boss | Ukuran dasar | 2.0× enemy, +0.25× per kemunculan |
| Boss | Size cap | 3.5× |
| Score | Enemy kill / headshot bonus / boss kill | 100 / +50 / +1000 |

## 15b. Audio (SFX dan Musik)

Implementasi: `src/audio/AudioManager.ts` (singleton `audio`), disintesis penuh dengan Web Audio API tanpa file eksternal.

- **Senjata:** tembakan Sniper (+ bolt-action), AKM, M4, Bazooka, tebasan/tusukan Knife, lemparan Granat, ledakan (granat dan roket, posisional), klik peluru habis, ganti senjata, reload (mulai/selesai).
- **Feedback:** hitmarker biasa dan headshot (ding), damage pemain, kematian pemain.
- **Pemain:** langkah kaki (walk/sprint), pendaratan setelah lompat.
- **Musuh:** serangan melee, tembakan rifle/plasma Boss, geraman acak, suara mati, raungan Boss. Semua posisional (volume, filter jarak, stereo pan).
- **Alur game:** stinger wave start/clear, supply crate, pickup, defeat/victory.
- **BGM adaptif:** `calm` (menu & intermission), `combat` (wave biasa), `boss` (boss wave); di-duck saat Pause, berhenti saat Game Over.
- **Kontrol:** `M` untuk mute/unmute (tersimpan di localStorage). AudioContext baru aktif setelah gesture pertama pemain (kebijakan autoplay browser).

## 16. Target Arsitektur

```text
warzone-strike/
├── src/
│   ├── core/         GameManager, GameState
│   ├── player/       PlayerController, PlayerHealth, PlayerCamera
│   ├── weapons/      Weapon, Sniper, Knife
│   ├── enemies/      Enemy, EnemyAI, EnemyHealth, Boss
│   ├── wave/         WaveManager, WaveConfig, SpawnManager
│   ├── scoring/      ScoreManager
│   ├── leaderboard/  LeaderboardClient, MockLeaderboardClient, ScorePayload, ScoreSubmissionQueue
│   ├── identity/     PlayerIdentityProvider, MockPlayerIdentityProvider
│   ├── ui/           HUD, MainMenu, PauseMenu, GameOverScreen
│   └── data/         map.json, weapons.json, waves.json
├── public/assets/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Struktur ini adalah **target**. Buat file saat dibutuhkan fase yang berjalan, bukan sekaligus.

### Pemisahan logic dan visual

Contoh: logic sniper (ammo, damage, fire, reload, raycast, headshot) terpisah dari visual sniper (model 3D, animasi, muzzle flash, recoil visual). Placeholder dapat diganti `.glb`/`.gltf` lewat `GLTFLoader` tanpa menulis ulang logic.
