#!/usr/bin/env node
/**
 * Capacitor-pariteitscontrole: package.json vs. de native projecten.
 *
 * Run: `node scripts/verify-capacitor-sync.mjs`
 *
 * Waarom dit bestaat: de gegenereerde native manifesten (twee gradle-bestanden
 * en de Podfile) worden alleen bijgewerkt als iemand `npx cap sync` draait en
 * de uitkomst commit. Tussen 7 augustus en 10 september 2026 gebeurde dat voor
 * Android niet, waardoor @capacitor/app, browser, keyboard en status-bar wel in
 * package.json stonden maar niet in de Android-build meekwamen. De iOS-Podfile
 * liep wel mee omdat Xcode Cloud die nodig heeft; Android heeft geen CI die
 * omvalt, dus niemand merkte het. Gevolg zou zijn: Browser en App stil kapot op
 * Android, en de Android-specifieke Keyboard/StatusBar-instellingen uit
 * capacitor.config.ts zonder effect — terwijl iOS gewoon werkt.
 *
 * Werkwijze — geen enkele naam wordt afgeleid of geraden:
 *   - een dependency is een Capacitor-plugin als zijn package.json een
 *     `capacitor`-sleutel heeft; diezelfde sleutel vertelt welke platforms hij
 *     ondersteunt (capacitor.android / capacitor.ios)
 *   - de native bestanden worden geparsed op het node_modules-PAD, niet op de
 *     gradle-projectnaam of de pod-naam, want die zijn afgeleid en dus fragiel
 *   - er wordt in beide richtingen vergeleken: ontbrekende plugins én
 *     achtergebleven verwijzingen naar een verwijderde plugin
 *   - de twee Android-bestanden worden ook onderling gekruist, want ze kunnen
 *     los van elkaar scheefgroeien
 *
 * Exit 0 bij pariteit, exit 1 bij enig gat.
 *
 * Geen dependencies. Vereist wel een geïnstalleerde node_modules.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SETTINGS_GRADLE = join(ROOT, 'android', 'capacitor.settings.gradle');
const BUILD_GRADLE = join(ROOT, 'android', 'app', 'capacitor.build.gradle');
const PODFILE = join(ROOT, 'ios', 'App', 'Podfile');

/**
 * De platform-runtimes. Die staan in de native bestanden maar zijn geen plugin
 * (hun package.json heeft geen `capacitor`-sleutel), dus ze zouden anders als
 * "verweesd" worden gemeld.
 */
const PLATFORM_PACKAGES = new Set(['@capacitor/android', '@capacitor/ios']);

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

/** Verzamelde problemen; elk item is één regel output. */
const problems = [];
/** Losse waarschuwingen die de exit code niet rood maken. */
const warnings = [];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`${c.red}Kan ${file} niet lezen of parsen:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

function readTextOrNull(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

// ---------------------------------------------------------------------------
// 1. Welke dependencies zijn Capacitor-plugins, en voor welke platforms?
// ---------------------------------------------------------------------------

const pkg = readJson(join(ROOT, 'package.json'));
const deps = Object.keys(pkg.dependencies ?? {});

if (!existsSync(join(ROOT, 'node_modules'))) {
  console.error(
    `${c.red}node_modules ontbreekt.${c.reset} Dit script leest de package.json van elke dependency om te bepalen of het een Capacitor-plugin is. Draai eerst \`bun install\`.\n`
  );
  process.exit(1);
}

/** @type {{ name: string, android: boolean, ios: boolean }[]} */
const plugins = [];

for (const dep of deps) {
  const manifest = join(ROOT, 'node_modules', dep, 'package.json');
  if (!existsSync(manifest)) {
    warnings.push(`${dep} staat in package.json maar niet in node_modules — overgeslagen.`);
    continue;
  }
  const meta = readJson(manifest);
  if (!meta.capacitor) continue;
  plugins.push({
    name: dep,
    android: Boolean(meta.capacitor.android),
    ios: Boolean(meta.capacitor.ios),
  });
}

// ---------------------------------------------------------------------------
// 2. Android — capacitor.settings.gradle en app/capacitor.build.gradle
// ---------------------------------------------------------------------------

const settingsSrc = readTextOrNull(SETTINGS_GRADLE);
const buildSrc = readTextOrNull(BUILD_GRADLE);

if (settingsSrc === null || buildSrc === null) {
  warnings.push('Geen Android-project gevonden — de Android-controles zijn overgeslagen.');
} else {
  // Elke regel ziet eruit als:
  //   project(':capacitor-app').projectDir = new File('../node_modules/@capacitor/app/android')
  // We pakken de gradle-projectnaam en het pad, en strippen van het pad het
  // laatste segment (de bronmap binnen de plugin: 'android', of 'capacitor'
  // bij de platform-runtime) om op de package-naam uit te komen.
  const settingsEntries = [];
  const entryRe = /project\('([^']+)'\)\.projectDir\s*=\s*new File\('\.\.\/node_modules\/([^']+)'\)/g;
  for (const match of settingsSrc.matchAll(entryRe)) {
    const gradleName = match[1].replace(/^:/, '');
    const segments = match[2].split('/');
    segments.pop();
    settingsEntries.push({ gradleName, pkg: segments.join('/') });
  }

  const settingsPkgs = new Set(settingsEntries.map((e) => e.pkg));

  // 2a. Plugin geïnstalleerd maar niet in settings.gradle.
  for (const plugin of plugins) {
    if (plugin.android && !settingsPkgs.has(plugin.name)) {
      problems.push(
        `${c.bold}${plugin.name}${c.reset} ontbreekt in android/capacitor.settings.gradle`
      );
    }
  }

  // 2b. Verwijzing in settings.gradle naar iets dat geen plugin (meer) is.
  const androidPluginNames = new Set(plugins.filter((p) => p.android).map((p) => p.name));
  for (const entry of settingsEntries) {
    if (PLATFORM_PACKAGES.has(entry.pkg)) continue;
    if (!androidPluginNames.has(entry.pkg)) {
      problems.push(
        `${c.bold}${entry.pkg}${c.reset} staat nog in android/capacitor.settings.gradle maar is geen geïnstalleerde Android-plugin meer`
      );
    }
  }

  // 2c. De twee gradle-bestanden onderling. build.gradle somt de plugins op als
  //     `implementation project(':naam')` en laat de platform-runtime bewust weg.
  const buildNames = new Set(
    [...buildSrc.matchAll(/implementation project\('([^']+)'\)/g)].map((m) => m[1].replace(/^:/, ''))
  );

  for (const entry of settingsEntries) {
    if (PLATFORM_PACKAGES.has(entry.pkg)) continue;
    if (!buildNames.has(entry.gradleName)) {
      problems.push(
        `${c.bold}:${entry.gradleName}${c.reset} staat in capacitor.settings.gradle maar niet in app/capacitor.build.gradle`
      );
    }
  }

  const settingsNames = new Set(settingsEntries.map((e) => e.gradleName));
  for (const name of buildNames) {
    if (!settingsNames.has(name)) {
      problems.push(
        `${c.bold}:${name}${c.reset} staat in app/capacitor.build.gradle maar niet in capacitor.settings.gradle`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 3. iOS — de Podfile
// ---------------------------------------------------------------------------

const podfileSrc = readTextOrNull(PODFILE);

if (podfileSrc === null) {
  warnings.push('Geen iOS-Podfile gevonden — de iOS-controle is overgeslagen.');
} else {
  // Elke regel ziet eruit als:
  //   pod 'CapacitorApp', :path => '../../node_modules/@capacitor/app'
  const podPkgs = new Set(
    [...podfileSrc.matchAll(/pod\s+'[^']+',\s*:path\s*=>\s*'\.\.\/\.\.\/node_modules\/([^']+)'/g)].map(
      (m) => m[1]
    )
  );

  for (const plugin of plugins) {
    if (plugin.ios && !podPkgs.has(plugin.name)) {
      problems.push(`${c.bold}${plugin.name}${c.reset} ontbreekt in ios/App/Podfile`);
    }
  }

  const iosPluginNames = new Set(plugins.filter((p) => p.ios).map((p) => p.name));
  for (const podPkg of podPkgs) {
    if (PLATFORM_PACKAGES.has(podPkg)) continue;
    if (!iosPluginNames.has(podPkg)) {
      problems.push(
        `${c.bold}${podPkg}${c.reset} staat nog in ios/App/Podfile maar is geen geïnstalleerde iOS-plugin meer`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Uitkomst
// ---------------------------------------------------------------------------

console.log('');
console.log(
  `${c.bold}Capacitor-pariteit${c.reset} ${c.dim}— ${plugins.length} ${
    plugins.length === 1 ? 'plugin' : 'plugins'
  } in package.json${c.reset}`
);
for (const plugin of plugins) {
  const platforms = [plugin.android ? 'android' : null, plugin.ios ? 'ios' : null]
    .filter(Boolean)
    .join(' + ');
  console.log(`  ${c.dim}·${c.reset} ${plugin.name} ${c.dim}(${platforms})${c.reset}`);
}
console.log('');

for (const warning of warnings) {
  console.log(`${c.yellow}Let op:${c.reset} ${warning}`);
}
if (warnings.length > 0) console.log('');

if (problems.length > 0) {
  console.log(
    `${c.red}${c.bold}Native projecten lopen uit de pas${c.reset} ${c.dim}(${problems.length} ${
      problems.length === 1 ? 'punt' : 'punten'
    })${c.reset}`
  );
  for (const problem of problems) {
    console.log(`  ${c.red}✗${c.reset} ${problem}`);
  }
  console.log('');
  console.log(
    `${c.dim}Herstel: draai \`npx cap sync\` en commit de gewijzigde bestanden. Let op dat \`cap sync ios\` CocoaPods en macOS vereist — draai hem dus niet alleen voor Android.${c.reset}\n`
  );
  process.exit(1);
}

console.log(
  `${c.green}${c.bold}Pariteit.${c.reset} Elke plugin staat in de native projecten van de platforms die hij ondersteunt.\n`
);
process.exit(0);
