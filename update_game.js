const fs = require('fs');
let code = fs.readFileSync('game.js', 'utf8');

// 1. Remove LEVEL_BOOST_PADS and SpeedBoosterZone (lines 1197 to 1360 roughly)
// We can use a regex that matches from "const LEVEL_BOOST_PADS = {" to "class PlayerOrb {"
code = code.replace(/\/\/\s*Per-Level Speed Boost Pad Configs[\s\S]*?class PlayerOrb/m, "class PlayerOrb");

// 2. Remove this.boosters = [];
code = code.replace(/this\.hazards = \[\];\s*this\.boosters = \[\];\s*this\.portal = null;/, "this.hazards = [];\n        this.portal = null;");

// 3. Remove pad instantiation in loadLevel
code = code.replace(/\/\/ Dynamically instantiate per-level boost pads[\s\S]*?const skin = this\.saveSystem/, "const skin = this.saveSystem");

// 4. Remove booster update
code = code.replace(/for\s*\(const booster of this\.boosters\)\s*\{\s*booster\.update\(dt, this\);\s*\}\s*if\s*\(this\.portal\)/, "if (this.portal)");

// 5. Remove booster draw
code = code.replace(/for\s*\(const booster of this\.boosters\)\s*\{\s*booster\.draw\(this\.ctx\);\s*\}/, "");

// 6. Update worldConfigs
const lockedWorlds = `            {
                title:  dict.world3Title || 'SOLAR CORE',
                sub:    dict.world3Sub   || 'WORLD 3 • LEVELS 21–30',
                badge:  '🔒',
                color:  '#555',
                startLvl: 24, endLvl: 33, count: 10, maxStars: 30,
                locked: true,
                art: \`<div class="wpa-portal" style="filter: grayscale(1) opacity(0.5)"></div>\`
            },
            {
                title:  'ABYSSAL VOID',
                sub:    'WORLD 4 • LEVELS 31–40',
                badge:  '🔒',
                color:  '#555',
                startLvl: 34, endLvl: 43, count: 10, maxStars: 30,
                locked: true,
                art: \`<div class="wpa-portal" style="filter: grayscale(1) opacity(0.5)"></div>\`
            }
        ];`;
code = code.replace(/\{\s*title:\s*dict\.world3Title[\s\S]*?\];/, lockedWorlds);

// 7. Update rendering loops from '4' to 'worldConfigs.length'
code = code.replace(/for\s*\(let w = 0; w < 4; w\+\+\)\s*\{\s*const cfg = worldConfigs\[w\];/, "for (let w = 0; w < worldConfigs.length; w++) {\n            const cfg = worldConfigs[w];");
code = code.replace(/for\s*\(let w = 0; w < 4; w\+\+\)\s*\{\s*dotsHtml \+=/, "for (let w = 0; w < worldConfigs.length; w++) {\n                dotsHtml +=");

// 8. Update rendering inner HTML for coming soon
const oldCardHtml = `                        <div class="world-badge-group">
                            <span class="world-badge">\${cfg.badge}</span>
                            <span class="world-card-sub">\${cfg.sub}</span>
                        </div>
                        <div class="world-progress-badge\${allClear ? ' all-clear' : ''}">
                            ⭐ \${worldStars}/\${cfg.maxStars}
                        </div>
                    </div>
                    <h3 class="world-card-title" style="color:\${cfg.color}">\${cfg.title}</h3>`;
const newCardHtml = `                        <div class="world-badge-group">
                            <span class="world-badge">\${cfg.badge}</span>
                            <span class="world-card-sub">\${cfg.locked ? 'COMING SOON' : cfg.sub}</span>
                        </div>
                        \${!cfg.locked ? \`<div class="world-progress-badge\${allClear ? ' all-clear' : ''}">
                            ⭐ \${worldStars}/\${cfg.maxStars}
                        </div>\` : ''}
                    </div>
                    <h3 class="world-card-title" style="color:\${cfg.color}">\${cfg.locked ? 'COMING SOON' : cfg.title}</h3>`;
code = code.replace(oldCardHtml, newCardHtml);

// 9. Prevent expanding locked worlds
code = code.replace(/_openWorldExpanded\(worldNum\) \{/, "_openWorldExpanded(worldNum) {\n        if (worldNum >= 3) return; // Locked worlds");

fs.writeFileSync('game.js', code);
console.log('Update complete.');
