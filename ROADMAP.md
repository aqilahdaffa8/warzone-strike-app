# ROADMAP.md — Warzone Strike

Urutan pengerjaan. Kerjakan **satu fase per waktu**. Jangan mulai fase berikutnya sebelum fase saat ini terverifikasi (definisi verifikasi ada di `AGENTS.md` bagian 5). Detail fitur ada di `GAME_SPEC.md`.

Prioritas umum:

```text
Gameplay/Logic → Arsitektur → Stabilitas → Balancing → Asset/Animasi → VFX/Audio → UI polish → Leaderboard resmi → Desktop packaging
```

Setiap fase diakhiri dengan: `npm run build` lolos, `npm run dev` tanpa error console, checklist acceptance dijalankan manual, lalu commit.

---

## Phase 1 — Project Setup (mulai dari sini)

**Target:** Vite + TypeScript (strict) + Three.js (versi di-pin), renderer, camera, lighting dasar, arena placeholder dari primitive geometry (ground, wall, box, container).

**Acceptance:**
- [ ] `npm install` dan `npm run dev` berhasil
- [ ] Halaman browser menampilkan arena 3D sederhana
- [ ] Tidak ada fatal runtime error
- [ ] `npm run build` lolos
- [ ] Resize window tidak merusak tampilan
- [ ] Tidak ada request ke CDN/URL eksternal saat runtime (semua di-bundle Vite); game tetap tampil dengan jaringan dimatikan setelah halaman dimuat

**Jangan dikerjakan di fase ini:** sniper, knife, enemy, wave, boss, leaderboard, MySQL, login, backend, desktop packaging, asset final, dependency tambahan.

---

## Phase 2 — Player, Health Dasar, HUD Minimal

**Target:** FPS controller (WASD, mouse look via Pointer Lock), delta time, collision AABB dasar, starting position, `PlayerHealth` (nilai dan fungsi damage saja), HUD minimal (health; slot ammo disiapkan), pause via `pointerlockchange`, jump opsional.

**Acceptance:**
- [ ] Gerakan stabil dan tidak bergantung FPS
- [ ] Kamera bekerja dan sensitivity dapat diatur
- [ ] Pemain tidak menembus dinding/obstacle dasar dan bisa sliding di dinding
- [ ] Esc / kehilangan pointer lock memunculkan pause; resume berfungsi
- [ ] Klik kanan tidak memunculkan menu konteks browser
- [ ] Health pemain tampil di HUD dan dapat dikurangi (uji lewat tombol debug sementara)

---

## Phase 3 — Sniper

**Target:** sniper placeholder, fire (interval), raycast ke enemy + obstacle (hit terdekat), ammo, reload, scope + zoom, hitbox head/body dengan headshot, pencatatan `shotsFired`/`shotsHit`, target dummy sederhana untuk pengujian, ammo di HUD.

**Acceptance:**
- [ ] Sniper menembak sesuai fire interval
- [ ] Ammo berkurang; reload berfungsi dan tidak bisa menembak saat reload
- [ ] Scope dan zoom bekerja (FOV, overlay, sensitivity)
- [ ] Peluru tidak menembus dinding
- [ ] Target dummy menerima damage; headshot memberi damage lebih besar
- [ ] `shotsFired` dan `shotsHit` tercatat benar

---

## Phase 4 — Knife

**Target:** knife placeholder, attack dengan cooldown, short-range hit detection, weapon switching (1, 2, scroll).

**Acceptance:**
- [ ] Switching sniper ↔ knife bekerja (tombol dan scroll)
- [ ] Knife mengenai target dalam range dan tidak di luar range
- [ ] Cooldown knife bekerja
- [ ] Sniper tetap berfungsi normal (ammo, reload, scope) setelah switching
- [ ] Switching saat reload atau scope tidak meninggalkan state rusak

---

## Phase 5 — Enemy

**Target:** enemy placeholder (body + head hitbox), mengejar pemain, melee attack dengan cooldown ke `PlayerHealth`, health, death.

**Acceptance:**
- [ ] Enemy mendekati pemain
- [ ] Enemy menyerang dalam range dan health pemain berkurang
- [ ] Enemy menerima damage dari sniper dan knife, termasuk headshot
- [ ] Enemy mati dan dibersihkan dari scene (tanpa memory leak jelas)
- [ ] Enemy tidak menembus dinding

---

## Phase 6 — Wave

**Target:** `SpawnManager`, `WaveManager`, intermission, scaling jumlah/HP/damage, batas enemy aktif, `minSpawnDistance`, semua nilai dari config.

**Acceptance:**
- [ ] Wave dimulai, enemy di-generate sesuai config
- [ ] Wave berakhir saat semua enemy mati; wave berikutnya mulai setelah intermission
- [ ] Wave berlanjut tanpa batas
- [ ] Tidak ada enemy spawn lebih dekat dari `minSpawnDistance`
- [ ] Enemy aktif tidak melebihi batas
- [ ] Difficulty naik terkontrol; nilai bisa diubah dari config tanpa menyentuh logic

---

## Phase 7 — Boss

**Target:** boss dari enemy placeholder, spawn di wave kelipatan 5 setelah enemy biasa habis, scaling HP dan ukuran, size cap.

**Acceptance:**
- [ ] Boss muncul di wave 5, 10, 15, dst.
- [ ] Boss muncul hanya setelah enemy biasa wave itu mati
- [ ] HP dan ukuran naik tiap kemunculan; ukuran tidak melewati cap
- [ ] Setelah boss mati: intermission lalu wave berikutnya

---

## Phase 8 — Score dan Game Flow

**Target:** `ScoreManager` (kill, headshot bonus, boss kill), pencatatan statistik sesi (kills, headshots, bossesKilled, accuracy, durasi, wave), game over saat health habis, `GameState`, main menu, pause menu, game over screen, HUD lengkap (health, ammo, wave, score), tombol retry/main lagi.

**Acceptance:**
- [ ] Score bertambah sesuai event
- [ ] Health habis → game over tampil dan game berhenti
- [ ] State machine berpindah benar (MENU → PLAYING → PAUSED/GAME_OVER)
- [ ] Data akhir sesi (semua field payload) dapat dikumpulkan
- [ ] Memulai game baru mereset state dengan bersih (tanpa sisa enemy/score/timer lama)
- [ ] Game Over screen dan tombol main lagi berfungsi tanpa bergantung pada jaringan atau hasil submission

---

## Phase 9 — Mock Leaderboard

**Target:** `PlayerIdentityProvider` + `MockPlayerIdentityProvider`, `LeaderboardClient` + `MockLeaderboardClient` (dengan mode simulasi: sukses, gagal, timeout, offline/reconnect), `ScorePayload`, `sessionId` (UUID), `ScoreSubmissionQueue` (localStorage sebagai solusi MVP, dapat diganti IndexedDB), timeout submission, tombol Retry manual + retry otomatis sekali saat game dibuka (detail retry boleh disesuaikan), state `SUBMITTING_SCORE` / `SCORE_SUBMITTED`. Score selalu disimpan lokal sebelum submission dicoba.

**Acceptance:**
- [ ] Payload dibuat dari data sesi dengan semua field terisi
- [ ] `sessionId` unik per sesi
- [ ] Mock submission berjalan dan bisa disimulasikan gagal
- [ ] Submission gagal tetap ada di queue (bertahan setelah refresh halaman)
- [ ] Retry berhasil mengosongkan item dari queue
- [ ] `sessionId` yang sama tidak terkirim dua kali
- [ ] Score tersimpan lokal **sebelum** submission dicoba (uji: paksa gagal, refresh halaman, item masih ada)
- [ ] **API mati:** game tetap dapat dimulai, dimainkan, dan mencapai Game Over; score akhir tampil; item masuk queue tanpa error fatal
- [ ] **Timeout:** submission berhenti setelah batas waktu, UI tidak menggantung, item tetap di queue, pemain dapat main lagi
- [ ] **Reconnect / API pulih:** retry (manual, otomatis saat game dibuka, atau saat event `online`) berhasil mengirim item dan mengosongkan queue
- [ ] Game dapat dimainkan dari Main Menu sampai Game Over dengan jaringan dimatikan (DevTools offline)
- [ ] Kegagalan penulisan storage (mis. quota penuh) tidak membuat game crash

---

## Phase 10 — Visual dan Audio Polish

Baru setelah gameplay inti stabil dan diuji: ganti placeholder dengan asset final (GLB/GLTF dari user), animasi, VFX, muzzle flash, hit feedback, audio, scope presentation, polish environment dan UI. Jangan mengubah kontrak gameplay demi kebutuhan visual kecuali benar-benar perlu.

**Acceptance:**
- [ ] Semua acceptance fase 2–9 masih lulus setelah asset diganti
- [ ] Frame rate tetap wajar

---

## Phase 11 — Leaderboard Resmi

**Hanya dikerjakan setelah panitia memberikan spesifikasi resmi.** Data yang dibutuhkan sebelum mulai:

- endpoint resmi dan HTTP method
- metode autentikasi
- mekanisme identitas pemain dan sumber player ID resmi
- request schema dan response schema
- aturan duplicate submission
- perilaku error
- rate limit (jika ada)

Ketiadaan spesifikasi ini **tidak memblokir** fase 1–10 maupun 12. Sampai lengkap: **tetap pakai mock.** Implementasi resmi = `OfficialLeaderboardClient` + provider identitas resmi, tanpa mengubah gameplay.

---

## Phase 12 — Desktop Packaging

Setelah versi browser stabil dan diuji. Baru putuskan Tauri atau Electron, build configuration, packaging, dan penyesuaian khusus desktop bila perlu.
