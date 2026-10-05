# Asset Credits — Warzone Strike

## Phase 1 — Project Setup
- Semua geometri saat ini merupakan **Three.js procedural primitives** (`BoxGeometry`, `PlaneGeometry`, `GridHelper`).
- Tidak ada aset eksternal (model 3D, tekstur, audio) yang diunduh atau digunakan pada fase ini.
- Semua resource dibundle secara offline oleh Vite tanpa ketergantungan CDN atau URL eksternal.

## Audio (SFX & BGM)
- Seluruh audio **disintesis secara prosedural** lewat Web Audio API (`src/audio/AudioManager.ts`): oscillator, noise buffer, filter, dan convolver reverb yang dibangkitkan lewat kode.
- Tidak ada file audio eksternal, sampel, atau lisensi pihak ketiga yang digunakan. Tidak ada entri `public/assets/audio/` yang diperlukan.
- Jika kelak diganti dengan file audio final, catat sumber dan lisensinya di bagian ini (Rule 04).

## Phase 10 — Visual dan Audio Polish
- Keputusan: visual tetap **prosedural** (primitive geometry + material Three.js). Tidak ada model GLB/GLTF, tekstur, atau gambar eksternal.
- Ikon/grafik item supply (`src/ui/SupplyItemGraphics.ts`) berupa SVG inline buatan sendiri di dalam kode.
- Tidak ada asset pihak ketiga, sehingga tidak ada lisensi yang perlu dicatat. Jika kelak ada asset eksternal, catat sumber dan lisensinya di sini (Rule 04).

