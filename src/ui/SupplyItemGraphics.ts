/**
 * Realistic Military SVG Visual Assets for Tactical Supply Items.
 * Designed with precise proportions, metallic gradients, carbon finishes,
 * and realistic ordnance styling for an authentic first-person shooter aesthetic.
 */

export function getAkmSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="akm-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3a3d40"/>
          <stop offset="40%" stop-color="#1f2224"/>
          <stop offset="70%" stop-color="#141618"/>
          <stop offset="100%" stop-color="#2a2c2e"/>
        </linearGradient>
        <linearGradient id="akm-wood" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stop-color="#93461c"/>
          <stop offset="35%" stop-color="#5a290d"/>
          <stop offset="65%" stop-color="#803b14"/>
          <stop offset="100%" stop-color="#411b08"/>
        </linearGradient>
        <linearGradient id="akm-barrel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4a4d50"/>
          <stop offset="50%" stop-color="#222527"/>
          <stop offset="100%" stop-color="#121314"/>
        </linearGradient>
      </defs>
      <!-- Barrel & Gas System -->
      <rect x="180" y="66" width="145" height="7" rx="1.5" fill="url(#akm-barrel)" stroke="#111" stroke-width="0.8"/>
      <rect x="185" y="55" width="80" height="9" rx="2" fill="url(#akm-barrel)" stroke="#111" stroke-width="0.8"/>
      <path d="M 265 54 L 275 62 L 275 66 L 265 66 Z" fill="#222"/>
      <!-- Slant Muzzle Brake -->
      <path d="M 325 64 L 338 61 L 338 74 L 325 74 Z" fill="#1b1c1e" stroke="#111" stroke-width="0.8"/>
      <!-- Front Sight Post -->
      <path d="M 312 66 L 312 45 L 318 45 L 318 66 Z" fill="#282a2c"/>
      <line x1="315" y1="45" x2="315" y2="40" stroke="#f0f6fc" stroke-width="1.8"/>
      <circle cx="315" cy="48" r="4.5" fill="none" stroke="#222" stroke-width="1.5"/>
      <!-- Wooden Handguard & Gas Tube Cover -->
      <path d="M 182 54 L 250 54 Q 256 58 254 77 L 180 77 Q 178 62 182 54 Z" fill="url(#akm-wood)" stroke="#221" stroke-width="1"/>
      <line x1="195" y1="58" x2="240" y2="58" stroke="#3d1b08" stroke-width="1" opacity="0.6"/>
      <line x1="190" y1="68" x2="245" y2="68" stroke="#3d1b08" stroke-width="1" opacity="0.6"/>
      <!-- Stamped Steel Receiver -->
      <rect x="95" y="55" width="90" height="28" rx="2" fill="url(#akm-steel)" stroke="#0d0e0f" stroke-width="1"/>
      <!-- Dust Cover & Serrations -->
      <path d="M 96 55 Q 140 50 185 55 L 185 64 L 96 64 Z" fill="#2a2c2e"/>
      <circle cx="106" cy="68" r="2.5" fill="#444"/>
      <circle cx="118" cy="68" r="2.5" fill="#444"/>
      <!-- Bolt Carrier & Charging Handle -->
      <rect x="142" y="58" width="22" height="6" fill="#666" rx="1"/>
      <path d="M 152 64 L 160 67 L 157 70 L 149 67 Z" fill="#888"/>
      <!-- Curved Ribbed 30-round Banana Magazine -->
      <path d="M 148 83 Q 155 115 130 148 L 105 142 Q 130 112 126 83 Z" fill="url(#akm-steel)" stroke="#0b0c0d" stroke-width="1.2"/>
      <path d="M 142 95 Q 146 115 128 135" stroke="#4f5255" stroke-width="1.5" fill="none"/>
      <path d="M 136 92 Q 140 112 122 132" stroke="#4f5255" stroke-width="1.5" fill="none"/>
      <!-- Wooden Pistol Grip -->
      <path d="M 98 83 L 80 128 L 98 132 L 114 83 Z" fill="url(#akm-wood)" stroke="#221" stroke-width="1"/>
      <!-- Trigger Guard & Trigger -->
      <path d="M 115 83 Q 118 100 132 100 L 138 83" fill="none" stroke="#2a2c2e" stroke-width="2"/>
      <path d="M 124 85 Q 128 92 123 95" fill="none" stroke="#666" stroke-width="2"/>
      <!-- Laminated Birch Wooden Stock -->
      <path d="M 95 60 L 15 72 Q 10 92 15 112 L 95 83 Z" fill="url(#akm-wood)" stroke="#221" stroke-width="1.2"/>
      <!-- Metal Buttplate & Sling Swivel -->
      <path d="M 15 72 L 11 73 Q 6 92 11 111 L 15 112 Z" fill="#222"/>
      <circle cx="28" cy="98" r="3" fill="#111"/>
    </svg>
  `;
}

export function getM4Svg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="m4-upper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#34373b"/>
          <stop offset="40%" stop-color="#1e2023"/>
          <stop offset="100%" stop-color="#111214"/>
        </linearGradient>
        <linearGradient id="m4-rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2d3033"/>
          <stop offset="50%" stop-color="#1a1c1e"/>
          <stop offset="100%" stop-color="#101112"/>
        </linearGradient>
        <linearGradient id="m4-mag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3c4045"/>
          <stop offset="60%" stop-color="#212427"/>
          <stop offset="100%" stop-color="#151719"/>
        </linearGradient>
      </defs>
      <!-- Barrel & Flash Hider -->
      <rect x="180" y="66" width="135" height="7" rx="1.5" fill="#222" stroke="#0a0a0a" stroke-width="0.8"/>
      <rect x="315" y="64" width="22" height="11" rx="1" fill="#1a1c1e" stroke="#0a0a0a" stroke-width="1"/>
      <line x1="319" y1="64" x2="319" y2="75" stroke="#333" stroke-width="1.5"/>
      <line x1="324" y1="64" x2="324" y2="75" stroke="#333" stroke-width="1.5"/>
      <line x1="329" y1="64" x2="329" y2="75" stroke="#333" stroke-width="1.5"/>
      <!-- A-Frame Front Sight Post -->
      <path d="M 285 66 L 290 40 L 296 40 L 302 66 Z" fill="#25272a" stroke="#111" stroke-width="1"/>
      <line x1="293" y1="40" x2="293" y2="34" stroke="#f0f6fc" stroke-width="2"/>
      <!-- Picatinny Quad Rail Handguard -->
      <rect x="180" y="56" width="105" height="25" rx="2" fill="url(#m4-rail)" stroke="#0d0e10" stroke-width="1"/>
      <rect x="182" y="53" width="101" height="3" fill="#444"/>
      <rect x="182" y="81" width="101" height="3" fill="#444"/>
      <!-- Rail Ventilation Slots -->
      <rect x="190" y="64" width="12" height="8" rx="1" fill="#0d0e10"/>
      <rect x="210" y="64" width="12" height="8" rx="1" fill="#0d0e10"/>
      <rect x="230" y="64" width="12" height="8" rx="1" fill="#0d0e10"/>
      <rect x="250" y="64" width="12" height="8" rx="1" fill="#0d0e10"/>
      <rect x="270" y="64" width="10" height="8" rx="1" fill="#0d0e10"/>
      <!-- Upper & Lower Receiver -->
      <path d="M 100 52 L 180 52 L 180 82 L 140 82 L 132 100 L 100 82 Z" fill="url(#m4-upper)" stroke="#0d0e10" stroke-width="1"/>
      <!-- Flat-Top Picatinny Rail & Rear Sight / Carry Handle -->
      <rect x="100" y="48" width="80" height="4" fill="#3a3d42"/>
      <path d="M 108 48 L 115 36 L 155 36 L 165 48 Z" fill="#222" stroke="#111" stroke-width="0.8"/>
      <!-- STANAG 30-round 5.56mm Magazine -->
      <path d="M 134 82 L 148 136 L 122 142 L 112 82 Z" fill="url(#m4-mag)" stroke="#0d0e10" stroke-width="1"/>
      <line x1="126" y1="92" x2="138" y2="134" stroke="#444" stroke-width="1.2"/>
      <line x1="120" y1="92" x2="132" y2="134" stroke="#444" stroke-width="1.2"/>
      <!-- A2 Pistol Grip -->
      <path d="M 102 82 L 86 128 L 102 134 L 116 82 Z" fill="#1b1c1e" stroke="#0a0a0a" stroke-width="1"/>
      <rect x="94" y="98" width="8" height="5" rx="1" fill="#2d3034"/>
      <!-- Trigger Guard -->
      <path d="M 116 82 Q 120 98 132 98 L 134 82" fill="none" stroke="#222" stroke-width="2"/>
      <path d="M 124 84 Q 126 91 123 93" fill="none" stroke="#777" stroke-width="2"/>
      <!-- Buffer Tube & Collapsible LE/Crane Stock -->
      <rect x="35" y="61" width="65" height="11" fill="#2a2c2f" stroke="#111" stroke-width="1"/>
      <path d="M 30 52 L 75 52 L 68 85 L 20 85 Q 15 68 30 52 Z" fill="#1b1c1e" stroke="#0a0a0a" stroke-width="1.2"/>
      <!-- Ribbed Rubber Buttpad -->
      <rect x="15" y="52" width="7" height="34" rx="2" fill="#111"/>
    </svg>
  `;
}

export function getBazookaSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rpg-warhead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4d613e"/>
          <stop offset="40%" stop-color="#34432a"/>
          <stop offset="100%" stop-color="#1f2819"/>
        </linearGradient>
        <linearGradient id="rpg-copper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d48a37"/>
          <stop offset="50%" stop-color="#9a5a1a"/>
          <stop offset="100%" stop-color="#6e3c0a"/>
        </linearGradient>
        <linearGradient id="rpg-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#84451f"/>
          <stop offset="50%" stop-color="#542a11"/>
          <stop offset="100%" stop-color="#371806"/>
        </linearGradient>
        <linearGradient id="rpg-tube" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4a5246"/>
          <stop offset="50%" stop-color="#2c3328"/>
          <stop offset="100%" stop-color="#1a1e17"/>
        </linearGradient>
      </defs>
      <!-- Main Launcher Steel Tube -->
      <rect x="50" y="65" width="220" height="20" rx="2" fill="url(#rpg-tube)" stroke="#0d0f0c" stroke-width="1.2"/>
      <!-- Flared Exhaust Funnel -->
      <path d="M 50 65 L 20 54 L 20 96 L 50 85 Z" fill="#22281e" stroke="#0d0f0c" stroke-width="1.2"/>
      <!-- Wood Heat Shield Cover -->
      <rect x="110" y="61" width="85" height="28" rx="3" fill="url(#rpg-wood)" stroke="#1a0d05" stroke-width="1.2"/>
      <line x1="125" y1="61" x2="125" y2="89" stroke="#1a0d05" stroke-width="1.2"/>
      <line x1="150" y1="61" x2="150" y2="89" stroke="#1a0d05" stroke-width="1.2"/>
      <line x1="175" y1="61" x2="175" y2="89" stroke="#1a0d05" stroke-width="1.2"/>
      <!-- Dual Grips & Trigger Mechanism -->
      <path d="M 198 85 L 188 126 L 204 128 L 214 85 Z" fill="#1b1c1e" stroke="#0a0a0a" stroke-width="1"/>
      <path d="M 235 85 L 225 124 L 240 126 L 249 85 Z" fill="#1b1c1e" stroke="#0a0a0a" stroke-width="1"/>
      <!-- Optical Sight PGO-7 Bracket -->
      <path d="M 160 65 L 165 44 L 188 44 L 192 65 Z" fill="#222"/>
      <rect x="155" y="38" width="45" height="10" rx="2" fill="#1b1e22" stroke="#388bfd" stroke-width="0.8"/>
      <circle cx="158" cy="43" r="3" fill="#388bfd"/>
      <!-- PG-7V High-Explosive Rocket Warhead Loaded -->
      <!-- Rocket Sustainer Motor Tube -->
      <rect x="270" y="70" width="30" height="10" fill="#2c3328" stroke="#111" stroke-width="1"/>
      <!-- Expanding Cone Section -->
      <path d="M 300 70 L 315 54 L 315 96 L 300 80 Z" fill="url(#rpg-warhead)" stroke="#1a2015" stroke-width="1"/>
      <!-- Ogive High Explosive Body -->
      <path d="M 315 54 Q 345 56 350 75 Q 345 94 315 96 Z" fill="url(#rpg-warhead)" stroke="#1a2015" stroke-width="1"/>
      <!-- Detonator Fuse Tip (Copper / Brass) -->
      <path d="M 350 72 L 358 72 L 358 78 L 350 78 Z" fill="url(#rpg-copper)" stroke="#331c05" stroke-width="0.8"/>
    </svg>
  `;
}

export function getHealthPackSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ifak-coyote" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8a7356"/>
          <stop offset="60%" stop-color="#5a4b36"/>
          <stop offset="100%" stop-color="#3d3223"/>
        </linearGradient>
        <linearGradient id="cross-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f85149"/>
          <stop offset="100%" stop-color="#b62324"/>
        </linearGradient>
      </defs>
      <!-- Tactical IFAK Cordura Medical Pouch -->
      <rect x="50" y="24" width="150" height="112" rx="10" fill="url(#ifak-coyote)" stroke="#2d251a" stroke-width="2"/>
      <!-- Molle Webbing Straps -->
      <rect x="50" y="44" width="150" height="12" fill="#463a2a" opacity="0.8"/>
      <rect x="50" y="80" width="150" height="12" fill="#463a2a" opacity="0.8"/>
      <rect x="50" y="112" width="150" height="10" fill="#463a2a" opacity="0.8"/>
      <!-- Heavy Duty Zipper Lining -->
      <path d="M 48 34 Q 125 30 202 34" fill="none" stroke="#221e18" stroke-width="3"/>
      <!-- Velcro Identification Patch -->
      <rect x="95" y="54" width="60" height="50" rx="4" fill="#181a1b" stroke="#333" stroke-width="1.2"/>
      <!-- Tactical Medic Cross -->
      <rect x="119" y="60" width="12" height="38" rx="2" fill="url(#cross-red)"/>
      <rect x="106" y="73" width="38" height="12" rx="2" fill="url(#cross-red)"/>
      <!-- Combat Tourniquet CAT-Gen 7 on side -->
      <rect x="220" y="35" width="35" height="90" rx="6" fill="#1b1c1e" stroke="#0a0a0a" stroke-width="1.5"/>
      <rect x="223" y="45" width="29" height="12" rx="2" fill="#d29922"/>
      <rect x="225" y="72" width="25" height="6" fill="#444"/>
      <line x1="230" y1="60" x2="245" y2="110" stroke="#0d0e10" stroke-width="7" stroke-linecap="round"/>
      <!-- Trauma Dressing Pack (Israeli Bandage Vacuum Sealed) -->
      <rect x="268" y="42" width="55" height="80" rx="4" fill="#3a4539" stroke="#1e241d" stroke-width="1.5"/>
      <text x="295" y="75" font-family="monospace" font-size="8" font-weight="bold" fill="#7ee787" text-anchor="middle">EMERGENCY</text>
      <text x="295" y="87" font-family="monospace" font-size="8" font-weight="bold" fill="#7ee787" text-anchor="middle">BANDAGE</text>
      <rect x="275" y="96" width="41" height="4" fill="#f85149"/>
    </svg>
  `;
}

export function getFragGrenadeSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="grenade-cast" cx="40%" cy="40%" r="65%">
          <stop offset="0%" stop-color="#4e6245"/>
          <stop offset="50%" stop-color="#2d3b27"/>
          <stop offset="100%" stop-color="#141a11"/>
        </radialGradient>
        <linearGradient id="lever-yellow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f2cc60"/>
          <stop offset="60%" stop-color="#bb8009"/>
          <stop offset="100%" stop-color="#7a4f01"/>
        </linearGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="180" cy="142" rx="45" ry="10" fill="#000000" opacity="0.6"/>
      <!-- M67 Cast Steel Spherical Body -->
      <circle cx="180" cy="92" r="44" fill="url(#grenade-cast)" stroke="#0d120a" stroke-width="1.5"/>
      <!-- Fragmentation Seam Line -->
      <ellipse cx="180" cy="92" rx="44" ry="12" fill="none" stroke="#1f281b" stroke-width="1.8" opacity="0.8"/>
      <!-- Military Stencil Markings -->
      <text x="180" y="86" font-family="monospace" font-size="8" font-weight="bold" fill="#e3b341" text-anchor="middle" letter-spacing="1">GRENADE HAND</text>
      <text x="180" y="96" font-family="monospace" font-size="8.5" font-weight="bold" fill="#e3b341" text-anchor="middle" letter-spacing="1">FRAG M67</text>
      <text x="180" y="106" font-family="monospace" font-size="7" fill="#e3b341" text-anchor="middle">COMP B</text>
      <!-- Fuse Neck Collar (Brass / Steel) -->
      <rect x="171" y="40" width="18" height="12" fill="#55585b" stroke="#222" stroke-width="1"/>
      <rect x="168" y="32" width="24" height="10" rx="1.5" fill="#3a3d40" stroke="#111" stroke-width="1"/>
      <!-- Curved Safety Spoon Lever (Olive/Yellow Ordnance) -->
      <path d="M 172 32 Q 152 30 148 42 L 140 102 Q 138 115 145 116" fill="none" stroke="url(#lever-yellow)" stroke-width="7" stroke-linecap="round"/>
      <!-- Safety Pull Ring & Cotter Pin -->
      <circle cx="198" cy="42" r="14" fill="none" stroke="#c0c5cc" stroke-width="3"/>
      <circle cx="198" cy="42" r="12" fill="none" stroke="#777d85" stroke-width="1"/>
      <line x1="172" y1="42" x2="188" y2="42" stroke="#c0c5cc" stroke-width="3.5" stroke-linecap="round"/>
    </svg>
  `;
}

export function getDrumMagSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="drum-body" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#3b3f44"/>
          <stop offset="60%" stop-color="#1b1c1e"/>
          <stop offset="100%" stop-color="#0a0b0c"/>
        </radialGradient>
      </defs>
      <!-- Drum Circular Magazine Body -->
      <circle cx="180" cy="94" r="50" fill="url(#drum-body)" stroke="#000000" stroke-width="2"/>
      <circle cx="180" cy="94" r="42" fill="none" stroke="#2a2c2f" stroke-width="3"/>
      <circle cx="180" cy="94" r="30" fill="none" stroke="#25272a" stroke-width="2"/>
      <!-- Winding Key in Center -->
      <circle cx="180" cy="94" r="12" fill="#2d3034" stroke="#111" stroke-width="1.5"/>
      <rect x="168" y="90" width="24" height="8" rx="2" fill="#444"/>
      <!-- Top Feed Tower & Lips -->
      <path d="M 166 50 L 166 22 L 194 22 L 194 50 Z" fill="#222426" stroke="#000" stroke-width="1.5"/>
      <!-- Visible Brass Rounds in Feed Lip -->
      <rect x="172" y="24" width="16" height="6" rx="2" fill="#e3b341" stroke="#8a6112" stroke-width="0.8"/>
      <!-- Stamped Ribs on Drum Face -->
      <line x1="180" y1="44" x2="180" y2="60" stroke="#44484d" stroke-width="2"/>
      <line x1="145" y1="94" x2="130" y2="94" stroke="#44484d" stroke-width="2"/>
      <line x1="215" y1="94" x2="230" y2="94" stroke="#44484d" stroke-width="2"/>
      <line x1="180" y1="128" x2="180" y2="144" stroke="#44484d" stroke-width="2"/>
      <!-- Capacity Stencil -->
      <text x="180" y="118" font-family="monospace" font-size="10" font-weight="bold" fill="#7ee787" text-anchor="middle">75 RDS</text>
    </svg>
  `;
}

export function getSniperAmmoSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="brass-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffd56b"/>
          <stop offset="40%" stop-color="#d49b28"/>
          <stop offset="80%" stop-color="#91600b"/>
          <stop offset="100%" stop-color="#573602"/>
        </linearGradient>
        <linearGradient id="copper-tip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f58e51"/>
          <stop offset="50%" stop-color="#b8561d"/>
          <stop offset="100%" stop-color="#732f08"/>
        </linearGradient>
      </defs>
      <!-- Tactical Ammo Case Box (Open Top View) -->
      <rect x="55" y="32" width="250" height="96" rx="6" fill="#1b1d20" stroke="#388bfd" stroke-width="1.5"/>
      <text x="180" y="48" font-family="monospace" font-size="9" font-weight="bold" fill="#58a6ff" text-anchor="middle" letter-spacing="1">.338 LAPUA MAGNUM AP</text>
      <!-- 4 Heavy Caliber Sniper Cartridges Rendered Side-by-Side -->
      <!-- Cartridge 1 -->
      <g transform="translate(85, 54)">
        <rect x="0" y="16" width="36" height="14" rx="1.5" fill="url(#brass-grad)" stroke="#221500" stroke-width="0.8"/>
        <path d="M 36 18 L 44 20 L 44 26 L 36 28 Z" fill="url(#brass-grad)"/>
        <rect x="44" y="20" width="8" height="6" fill="url(#brass-grad)"/>
        <path d="M 52 20 Q 66 22 72 23 Q 66 24 52 26 Z" fill="url(#copper-tip)" stroke="#331400" stroke-width="0.6"/>
        <rect x="-3" y="15" width="3" height="16" rx="0.5" fill="#e3b341"/>
      </g>
      <!-- Cartridge 2 -->
      <g transform="translate(85, 78)">
        <rect x="0" y="16" width="36" height="14" rx="1.5" fill="url(#brass-grad)" stroke="#221500" stroke-width="0.8"/>
        <path d="M 36 18 L 44 20 L 44 26 L 36 28 Z" fill="url(#brass-grad)"/>
        <rect x="44" y="20" width="8" height="6" fill="url(#brass-grad)"/>
        <path d="M 52 20 Q 66 22 72 23 Q 66 24 52 26 Z" fill="url(#copper-tip)" stroke="#331400" stroke-width="0.6"/>
        <rect x="-3" y="15" width="3" height="16" rx="0.5" fill="#e3b341"/>
      </g>
      <!-- Cartridge 3 -->
      <g transform="translate(185, 54)">
        <rect x="0" y="16" width="36" height="14" rx="1.5" fill="url(#brass-grad)" stroke="#221500" stroke-width="0.8"/>
        <path d="M 36 18 L 44 20 L 44 26 L 36 28 Z" fill="url(#brass-grad)"/>
        <rect x="44" y="20" width="8" height="6" fill="url(#brass-grad)"/>
        <path d="M 52 20 Q 66 22 72 23 Q 66 24 52 26 Z" fill="url(#copper-tip)" stroke="#331400" stroke-width="0.6"/>
        <rect x="-3" y="15" width="3" height="16" rx="0.5" fill="#e3b341"/>
      </g>
      <!-- Cartridge 4 -->
      <g transform="translate(185, 78)">
        <rect x="0" y="16" width="36" height="14" rx="1.5" fill="url(#brass-grad)" stroke="#221500" stroke-width="0.8"/>
        <path d="M 36 18 L 44 20 L 44 26 L 36 28 Z" fill="url(#brass-grad)"/>
        <rect x="44" y="20" width="8" height="6" fill="url(#brass-grad)"/>
        <path d="M 52 20 Q 66 22 72 23 Q 66 24 52 26 Z" fill="url(#copper-tip)" stroke="#331400" stroke-width="0.6"/>
        <rect x="-3" y="15" width="3" height="16" rx="0.5" fill="#e3b341"/>
      </g>
    </svg>
  `;
}

export function getRifleAmmoSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ammo-can" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4a5a42"/>
          <stop offset="50%" stop-color="#2c3826"/>
          <stop offset="100%" stop-color="#171e14"/>
        </linearGradient>
      </defs>
      <!-- Heavy Military Steel Ammo Can M2A1 -->
      <rect x="85" y="44" width="190" height="92" rx="4" fill="url(#ammo-can)" stroke="#0e140c" stroke-width="2"/>
      <!-- Sealed Top Lid & Clasp -->
      <rect x="80" y="34" width="200" height="14" rx="3" fill="#3a4733" stroke="#0e140c" stroke-width="1.5"/>
      <rect x="160" y="22" width="40" height="14" rx="3" fill="none" stroke="#222b1e" stroke-width="3"/>
      <!-- Heavy Toggle Latch -->
      <rect x="255" y="42" width="16" height="25" rx="2" fill="#1b2118" stroke="#0d110b" stroke-width="1.2"/>
      <!-- Military Stencil Markings in Yellow -->
      <text x="175" y="70" font-family="monospace" font-size="10" font-weight="bold" fill="#e3b341" text-anchor="middle" letter-spacing="1">840 RDS 5.56MM / 7.62MM</text>
      <text x="175" y="86" font-family="monospace" font-size="9" font-weight="bold" fill="#e3b341" text-anchor="middle" letter-spacing="1">COMBAT MUNITIONS TIN</text>
      <text x="175" y="102" font-family="monospace" font-size="8" fill="#d29922" text-anchor="middle">LOT WZ-8894-AP</text>
      <!-- Embossed Ridge Reinforcement -->
      <rect x="105" y="60" width="8" height="60" rx="2" fill="#222b1e" opacity="0.6"/>
      <rect x="235" y="60" width="8" height="60" rx="2" fill="#222b1e" opacity="0.6"/>
    </svg>
  `;
}

export function getReloadUpgradeSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rl-mag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3a3d40"/>
          <stop offset="50%" stop-color="#1f2224"/>
          <stop offset="100%" stop-color="#2d3033"/>
        </linearGradient>
      </defs>
      <!-- Speed lines -->
      <line x1="40" y1="52" x2="112" y2="52" stroke="#58a6ff" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
      <line x1="28" y1="80" x2="104" y2="80" stroke="#58a6ff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
      <line x1="48" y1="108" x2="116" y2="108" stroke="#58a6ff" stroke-width="5" stroke-linecap="round" opacity="0.35"/>
      <!-- Curved magazine -->
      <path d="M 140 26 L 196 26 L 212 128 L 156 134 Z" fill="url(#rl-mag)" stroke="#0d0e10" stroke-width="2"/>
      <rect x="142" y="18" width="52" height="10" rx="2" fill="#c9a24a" stroke="#6b4f12" stroke-width="1"/>
      <line x1="150" y1="50" x2="205" y2="50" stroke="#444" stroke-width="2"/>
      <line x1="152" y1="76" x2="207" y2="76" stroke="#444" stroke-width="2"/>
      <line x1="154" y1="102" x2="209" y2="102" stroke="#444" stroke-width="2"/>
      <!-- Circular reload arrow -->
      <path d="M 282 52 A 36 36 0 1 1 262 110" fill="none" stroke="#e3b341" stroke-width="9" stroke-linecap="round"/>
      <path d="M 250 118 L 276 122 L 262 98 Z" fill="#e3b341"/>
      <text x="262" y="86" font-family="monospace" font-size="16" font-weight="bold" fill="#e3b341" text-anchor="middle">FAST</text>
    </svg>
  `;
}

export function getDamageUpgradeSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dm-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e3b341"/>
          <stop offset="50%" stop-color="#a37a1c"/>
          <stop offset="100%" stop-color="#6b4f12"/>
        </linearGradient>
        <linearGradient id="dm-tip" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#8a1c1c"/>
          <stop offset="100%" stop-color="#f85149"/>
        </linearGradient>
      </defs>
      <!-- Burst behind the round -->
      <polygon points="270,20 284,56 322,46 298,78 336,96 296,104 308,142 270,120 236,146 238,108 198,100 234,84 214,50 252,58" fill="#f85149" opacity="0.28"/>
      <!-- Armor-piercing round -->
      <rect x="60" y="62" width="130" height="38" rx="3" fill="url(#dm-brass)" stroke="#3a2a08" stroke-width="2"/>
      <rect x="168" y="62" width="14" height="38" fill="#7a5a14"/>
      <path d="M 190 62 L 250 72 Q 276 81 250 90 L 190 100 Z" fill="url(#dm-tip)" stroke="#4a0f0f" stroke-width="2"/>
      <rect x="52" y="58" width="12" height="46" rx="2" fill="#6b4f12" stroke="#3a2a08" stroke-width="1.5"/>
      <!-- Plus damage marks -->
      <text x="278" y="62" font-family="monospace" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">+DMG</text>
      <rect x="86" y="74" width="70" height="3" fill="#fff" opacity="0.35"/>
    </svg>
  `;
}

export function getMaxHpUpgradeSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hp-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4a5560"/>
          <stop offset="55%" stop-color="#2a3138"/>
          <stop offset="100%" stop-color="#171b1f"/>
        </linearGradient>
        <linearGradient id="hp-heart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff7b72"/>
          <stop offset="100%" stop-color="#b62324"/>
        </linearGradient>
      </defs>
      <!-- Ceramic armor plate -->
      <path d="M 180 14 L 258 34 L 258 88 Q 258 128 180 148 Q 102 128 102 88 L 102 34 Z" fill="url(#hp-plate)" stroke="#0d0e10" stroke-width="3"/>
      <path d="M 180 26 L 246 42 L 246 88 Q 246 120 180 136 Q 114 120 114 88 L 114 42 Z" fill="none" stroke="#6e7b87" stroke-width="1.5" opacity="0.7"/>
      <!-- Heart -->
      <path d="M 180 108 C 140 82 148 54 168 56 C 176 57 180 64 180 64 C 180 64 184 57 192 56 C 212 54 220 82 180 108 Z" fill="url(#hp-heart)" stroke="#5c1111" stroke-width="1.5"/>
      <!-- Plus -->
      <rect x="276" y="52" width="10" height="34" rx="2" fill="#7ee787"/>
      <rect x="264" y="64" width="34" height="10" rx="2" fill="#7ee787"/>
      <text x="62" y="86" font-family="monospace" font-size="13" font-weight="bold" fill="#7ee787" text-anchor="middle">MAX</text>
      <text x="62" y="102" font-family="monospace" font-size="13" font-weight="bold" fill="#7ee787" text-anchor="middle">HP</text>
    </svg>
  `;
}

export function getSniperRifleSvg(): string {
  return `
    <svg viewBox="0 0 360 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="snp-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3a3d40"/>
          <stop offset="50%" stop-color="#1c1f21"/>
          <stop offset="100%" stop-color="#2a2c2e"/>
        </linearGradient>
        <linearGradient id="snp-stock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b4a3a"/>
          <stop offset="100%" stop-color="#1f2a1e"/>
        </linearGradient>
        <linearGradient id="snp-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#58a6ff"/>
          <stop offset="100%" stop-color="#0d2a52"/>
        </linearGradient>
      </defs>
      <!-- Long barrel + muzzle brake -->
      <rect x="170" y="78" width="160" height="7" rx="1.5" fill="url(#snp-steel)" stroke="#111" stroke-width="0.8"/>
      <rect x="326" y="73" width="22" height="17" rx="2" fill="#1b1c1e" stroke="#111" stroke-width="1"/>
      <line x1="332" y1="75" x2="332" y2="88" stroke="#444" stroke-width="1.5"/>
      <line x1="338" y1="75" x2="338" y2="88" stroke="#444" stroke-width="1.5"/>
      <!-- Receiver and bolt -->
      <rect x="110" y="68" width="76" height="26" rx="3" fill="url(#snp-steel)" stroke="#111" stroke-width="1.2"/>
      <rect x="146" y="60" width="22" height="9" rx="2" fill="#2a2c2e" stroke="#111" stroke-width="1"/>
      <circle cx="172" cy="62" r="5" fill="#222" stroke="#111" stroke-width="1"/>
      <!-- Stock with cheek rest -->
      <path d="M 112 70 L 52 76 Q 40 78 42 92 L 48 118 L 98 112 L 112 94 Z" fill="url(#snp-stock)" stroke="#0e140c" stroke-width="1.5"/>
      <rect x="46" y="112" width="14" height="10" rx="2" fill="#111"/>
      <!-- Grip and magazine -->
      <path d="M 124 94 L 140 94 L 134 126 L 118 124 Z" fill="url(#snp-stock)" stroke="#0e140c" stroke-width="1.2"/>
      <rect x="150" y="94" width="22" height="22" rx="2" fill="#1b1c1e" stroke="#111" stroke-width="1.2"/>
      <!-- Bipod -->
      <line x1="236" y1="85" x2="224" y2="128" stroke="#2a2c2e" stroke-width="4" stroke-linecap="round"/>
      <line x1="244" y1="85" x2="256" y2="128" stroke="#2a2c2e" stroke-width="4" stroke-linecap="round"/>
      <!-- Scope -->
      <rect x="116" y="42" width="78" height="14" rx="4" fill="url(#snp-steel)" stroke="#111" stroke-width="1.2"/>
      <ellipse cx="196" cy="49" rx="9" ry="10" fill="url(#snp-lens)" stroke="#111" stroke-width="1.5"/>
      <ellipse cx="114" cy="49" rx="7" ry="8" fill="#10151c" stroke="#111" stroke-width="1.5"/>
      <line x1="196" y1="40" x2="196" y2="58" stroke="#e6edf3" stroke-width="0.8" opacity="0.8"/>
      <line x1="187" y1="49" x2="205" y2="49" stroke="#e6edf3" stroke-width="0.8" opacity="0.8"/>
      <rect x="132" y="56" width="6" height="12" fill="#222"/>
      <rect x="170" y="56" width="6" height="12" fill="#222"/>
    </svg>
  `;
}

// Graphic name aliases for clean importing
export const getAkmGraphic = getAkmSvg;
export const getM4Graphic = getM4Svg;
export const getBazookaGraphic = getBazookaSvg;
export const getHealthPackGraphic = getHealthPackSvg;
export const getGrenadeGraphic = getFragGrenadeSvg;
export const getMagazineUpgradeGraphic = getDrumMagSvg;
export const getSniperAmmoGraphic = getSniperAmmoSvg;
export const getRifleAmmoGraphic = getRifleAmmoSvg;
export const getReloadUpgradeGraphic = getReloadUpgradeSvg;
export const getDamageUpgradeGraphic = getDamageUpgradeSvg;
export const getMaxHpUpgradeGraphic = getMaxHpUpgradeSvg;
export const getSniperRifleGraphic = getSniperRifleSvg;
