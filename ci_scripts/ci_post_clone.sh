#!/bin/sh
#
# Xcode Cloud post-clone script — SellQo Admin (iOS)
#
# Xcode Cloud cloneert de repo en bouwt daarna enkel het native iOS-deel.
# De web-assets (Vite -> dist/) moeten dus vóór de archive gebouwd en met
# `cap sync` naar het iOS-project gekopieerd worden. Zonder dit script
# archiveert Xcode Cloud een lege of verouderde webview.
#
# Xcode Cloud draait dit script met de werkmap op ci_scripts/, niet op de
# repo-root. Vandaar de expliciete cd hieronder.
#
# Benodigdheden op de runner:
#   - Node 22 (zie .nvmrc) voor npm en vite
#   - Bun, omdat het prebuild-script `bunx tsx scripts/generate-sitemap.ts`
#     draait. Alleen Node volstaat niet: npm run build faalt dan meteen op
#     prebuild.
#   - CocoaPods, voor de Pods/-map en de xcconfig-bestanden die het archive
#     nodig heeft.
#
set -e

log() {
	echo "[post-clone] $*"
}

fail() {
	echo "[post-clone] FOUT: $*" >&2
	exit 1
}

# Homebrew ligt op Apple Silicon in /opt/homebrew, op Intel in /usr/local.
# Beide toevoegen zodat een verse brew-install direct vindbaar is.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin:$PATH"

# ---------------------------------------------------------------------------
# 0. Naar de repo-root
# ---------------------------------------------------------------------------
# Xcode Cloud zet CI_PRIMARY_REPOSITORY_PATH op de root van de gecloonde repo.
# Buiten Xcode Cloud (handmatig testen) leiden we hem af uit de scriptlocatie.
if [ -n "$CI_PRIMARY_REPOSITORY_PATH" ]; then
	REPO_ROOT="$CI_PRIMARY_REPOSITORY_PATH"
else
	REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

cd "$REPO_ROOT" || fail "kan niet naar repo-root $REPO_ROOT"
log "repo-root: $(pwd)"

[ -f package.json ] || fail "geen package.json in $(pwd) — verkeerde werkmap?"
[ -d ios/App ] || fail "geen ios/App in $(pwd) — Xcode-project ontbreekt?"

# ---------------------------------------------------------------------------
# 1. Node (guard: alleen installeren als hij ontbreekt)
# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
	log "Node aanwezig: $(node -v) — installatie overgeslagen"
else
	log "Node ontbreekt — installeren via Homebrew (node@22, conform .nvmrc)"
	command -v brew >/dev/null 2>&1 || fail "Homebrew ontbreekt, kan Node niet installeren"
	brew install node@22
	# node@22 is keg-only; het bin-pad moet expliciet op PATH.
	export PATH="$(brew --prefix node@22)/bin:$PATH"
	command -v node >/dev/null 2>&1 || fail "Node na installatie nog steeds niet vindbaar"
	log "Node geïnstalleerd: $(node -v)"
fi
log "npm: $(npm -v)"

# ---------------------------------------------------------------------------
# 2. Bun (nodig voor het prebuild-script: bunx tsx scripts/generate-sitemap.ts)
# ---------------------------------------------------------------------------
if command -v bun >/dev/null 2>&1; then
	log "Bun aanwezig: $(bun -v) — installatie overgeslagen"
else
	log "Bun ontbreekt — installeren (vereist door npm prebuild)"
	if command -v brew >/dev/null 2>&1 && brew install bun; then
		log "Bun via Homebrew geïnstalleerd"
	else
		log "Homebrew-installatie mislukt — terugvallen op de officiële installer"
		curl -fsSL https://bun.sh/install | bash || fail "Bun-installatie mislukt"
		export PATH="$HOME/.bun/bin:$PATH"
	fi
	command -v bun >/dev/null 2>&1 || fail "Bun na installatie nog steeds niet vindbaar"
	log "Bun geïnstalleerd: $(bun -v)"
fi

# ---------------------------------------------------------------------------
# 3. Dependencies
# ---------------------------------------------------------------------------
# npm ci is reproduceerbaar en vereist een package-lock.json die in sync is.
# Valt die weg of raakt hij uit sync, dan is npm install de vangnet-route.
if [ -f package-lock.json ]; then
	log "npm ci — dependencies installeren uit package-lock.json"
	npm ci || {
		log "npm ci mislukt — terugvallen op npm install"
		npm install
	}
else
	log "geen package-lock.json — npm install"
	npm install
fi
log "dependencies geïnstalleerd"

# ---------------------------------------------------------------------------
# 4. Web-app bouwen (vite build -> dist/, voorafgegaan door prebuild)
# ---------------------------------------------------------------------------
log "npm run build — Vite-bundel naar dist/"
npm run build
[ -d dist ] || fail "dist/ ontbreekt na de build"
log "build klaar — dist/ bevat $(find dist -type f | wc -l | tr -d ' ') bestanden"

# ---------------------------------------------------------------------------
# 5. Web-assets en plugins naar het iOS-project syncen
# ---------------------------------------------------------------------------
log "npx cap sync ios — web-assets en plugins naar ios/App"
npx cap sync ios
[ -d ios/App/App/public ] || fail "ios/App/App/public ontbreekt na cap sync"
log "cap sync klaar"

# ---------------------------------------------------------------------------
# 6. CocoaPods — Pods/ en de xcconfig-bestanden genereren
# ---------------------------------------------------------------------------
# cap sync draait pod install niet betrouwbaar op een kale runner: ontbreekt
# CocoaPods, dan slaat het die stap stil over. Het archive faalt vervolgens op
# "Unable to open Pods-App.release.xcconfig", omdat Xcode dat bestand uit
# Pods/Target Support Files verwacht.
if command -v pod >/dev/null 2>&1; then
	log "CocoaPods aanwezig: $(pod --version) — installatie overgeslagen"
else
	log "CocoaPods ontbreekt — installeren via Homebrew"
	command -v brew >/dev/null 2>&1 || fail "Homebrew ontbreekt, kan CocoaPods niet installeren"
	brew install cocoapods
	command -v pod >/dev/null 2>&1 || fail "CocoaPods na installatie nog steeds niet vindbaar"
	log "CocoaPods geïnstalleerd: $(pod --version)"
fi

# --repo-update is hier geen luxe: cap sync voegt de plugin-pods aan de Podfile
# toe, en @capacitor-firebase/messaging trekt FirebaseMessaging uit de
# CocoaPods-CDN. Zonder bijgewerkte spec-repo is die niet te resolven.
# Bewust geen --deployment: de ingecheckte Podfile.lock kent de plugin-pods nog
# niet, dus pod install moet de lock mogen bijwerken.
log "pod install --repo-update in ios/App"
cd ios/App || fail "kan niet naar ios/App"
pod install --repo-update
cd "$REPO_ROOT" || fail "kan niet terug naar repo-root $REPO_ROOT"

PODS_XCCONFIG="ios/App/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig"
[ -f "$PODS_XCCONFIG" ] || fail "$PODS_XCCONFIG ontbreekt na pod install — het archive faalt dan op 'Unable to open Pods-App.release.xcconfig'"
log "pod install klaar — Pods/ en de xcconfig-bestanden staan er"

log "post-clone succesvol afgerond"
