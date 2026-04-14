#!/usr/bin/env bash
# Vysdom AI Website — 9-Layer Verification Script
# Usage: bash scripts/verify.sh [--layer N] [--all]
# Exit codes: 0 = all pass, 1 = failures detected

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "${YELLOW}⊘ SKIP${NC}: $1"; SKIP=$((SKIP + 1)); }
header() { echo -e "\n${CYAN}═══ $1 ═══${NC}"; }

# Resolve project root (script lives in vysdomai-website/scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

LAYER="${1:-all}"

# ═══════════════════════════════════════════════════════════════
# Layer 1: Build Integrity
# ═══════════════════════════════════════════════════════════════
run_l1() {
  header "L1: Build Integrity"
  
  # Biome lint
  if npx biome check . --no-errors-on-unmatched 2>/dev/null; then
    pass "Biome lint"
  else
    fail "Biome lint errors detected"
  fi
  
  # TypeScript strict
  if npx tsc --noEmit 2>/dev/null; then
    pass "TypeScript strict mode"
  else
    fail "TypeScript type errors detected"
  fi
  
  # Astro build
  if npm run build 2>/dev/null; then
    pass "Astro production build"
  else
    fail "Build failed"
  fi
  
  # npm audit
  if npm audit --audit-level=critical 2>/dev/null; then
    pass "No critical security advisories"
  else
    fail "Critical security advisories found"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 2: Design System Integrity
# ═══════════════════════════════════════════════════════════════
run_l2() {
  header "L2: Design System Integrity"
  
  if [ -d "src/components" ]; then
    COLORS=$( (grep -rn '\[#[0-9a-fA-F]' src/components/ 2>/dev/null || true) | wc -l | tr -d ' ')
    PIXELS=$( (grep -rn '\[[0-9]*px\]' src/components/ 2>/dev/null || true) | wc -l | tr -d ' ')
    
    if [ "$COLORS" -eq 0 ]; then
      pass "No arbitrary color values in components"
    else
      fail "Found $COLORS arbitrary color values in components"
    fi
    
    if [ "$PIXELS" -eq 0 ]; then
      pass "No arbitrary pixel values in components"
    else
      fail "Found $PIXELS arbitrary pixel values in components"
    fi
  else
    skip "src/components/ not found"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 3: Visual Fidelity
# ═══════════════════════════════════════════════════════════════
run_l3() {
  header "L3: Visual Fidelity"
  
  if [ -d "tests/e2e/visual" ]; then
    if npx playwright test tests/e2e/visual/ 2>/dev/null; then
      pass "Visual regression tests"
    else
      fail "Visual regression tests failed"
    fi
  else
    skip "Visual test directory not found"
  fi
  
  # Image size check (page-load images only — OG images are exempt)
  OVERSIZED=0
  while IFS= read -r f; do
    # Skip OG images (crawler-only, never loaded during page render)
    [[ "$(basename "$f")" == og-* ]] && continue
    [[ "$(basename "$f")" == *-og.* ]] && continue
    SIZE=$(stat -f%z "$f" 2>/dev/null || stat --printf='%s' "$f" 2>/dev/null || echo "0")
    if [ "$SIZE" -gt 204800 ]; then
      echo "  Oversized ($SIZE bytes): $f"
      OVERSIZED=$((OVERSIZED + 1))
    fi
  done < <(find public src -name "*.png" -o -name "*.jpg" -o -name "*.webp" 2>/dev/null)
  
  if [ "$OVERSIZED" -eq 0 ]; then
    pass "All page-load images within size budget (< 200KB)"
  else
    fail "$OVERSIZED oversized page-load images found"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 4: Accessibility
# ═══════════════════════════════════════════════════════════════
run_l4() {
  header "L4: Accessibility (WCAG 2.2 AA)"
  
  if [ -d "tests/e2e/a11y" ]; then
    if npx playwright test tests/e2e/a11y/ 2>/dev/null; then
      pass "Accessibility tests (axe-core)"
    else
      fail "Accessibility violations detected"
    fi
  else
    skip "Accessibility test directory not found"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 5: Performance
# ═══════════════════════════════════════════════════════════════
run_l5() {
  header "L5: Performance"
  
  if command -v lhci &> /dev/null || npx lhci --version &> /dev/null; then
    if npx lhci autorun 2>/dev/null; then
      pass "Lighthouse CI budgets"
    else
      fail "Lighthouse CI budget exceeded"
    fi
  else
    skip "Lighthouse CI not installed"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 6: Security & Legal
# ═══════════════════════════════════════════════════════════════
run_l6() {
  header "L6: Security & Legal"
  
  # Check required pages exist in build output
  if [ -d "dist/client" ]; then
    for page in "privacy" "terms"; do
      if [ -f "dist/client/${page}/index.html" ] || [ -f "dist/client/${page}.html" ]; then
        pass "Page exists: /${page}"
      else
        fail "Missing page: /${page}"
      fi
    done
  else
    skip "Build output (dist/client/) not found — run build first"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 7: SEO & Social
# ═══════════════════════════════════════════════════════════════
run_l7() {
  header "L7: SEO & Social"
  
  if [ -d "dist/client" ]; then
    # Check sitemap
    if [ -f "dist/client/sitemap-index.xml" ] || [ -f "dist/client/sitemap-0.xml" ]; then
      pass "XML sitemap exists"
    else
      fail "XML sitemap missing"
    fi
    
    # Check robots.txt
    if [ -f "dist/client/robots.txt" ]; then
      pass "robots.txt exists"
    else
      fail "robots.txt missing"
    fi
    
    # Check OG tags in homepage
    if grep -q 'og:title' dist/client/index.html 2>/dev/null; then
      pass "OG tags present in homepage"
    else
      fail "OG tags missing from homepage"
    fi
  else
    skip "Build output (dist/client/) not found — run build first"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 8: Conversion & Content
# ═══════════════════════════════════════════════════════════════
run_l8() {
  header "L8: Conversion & Content"
  
  # Link checker (linkinator via npm)
  if npx linkinator --help &> /dev/null; then
    if [ -d "dist/client" ]; then
      if npx linkinator dist/client/ --recurse --silent 2>/dev/null; then
        pass "All links valid (linkinator)"
      else
        fail "Broken links detected"
      fi
    else
      skip "Build output (dist/client/) not found"
    fi
  else
    skip "linkinator not installed"
  fi
  
  # E2E conversion tests
  if [ -d "tests/e2e/conversion" ]; then
    if npx playwright test tests/e2e/conversion/ 2>/dev/null; then
      pass "Conversion flow tests"
    else
      fail "Conversion flow tests failed"
    fi
  else
    skip "Conversion test directory not found"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Layer 9: Edge Cases
# ═══════════════════════════════════════════════════════════════
run_l9() {
  header "L9: Edge Cases"
  
  if [ -d "dist/client" ]; then
    # Check 404 page
    if [ -f "dist/client/404.html" ]; then
      pass "Custom 404 page exists"
    else
      fail "Custom 404 page missing"
    fi
  else
    skip "Build output (dist/client/) not found"
  fi
  
  # Edge case E2E tests
  if [ -d "tests/e2e/edge-cases" ]; then
    if npx playwright test tests/e2e/edge-cases/ 2>/dev/null; then
      pass "Edge case tests"
    else
      fail "Edge case tests failed"
    fi
  else
    skip "Edge case test directory not found"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════
echo "╔═══════════════════════════════════════════╗"
echo "║  Vysdom AI Website — Verification Suite   ║"
echo "║  9-Layer Quality Stack                    ║"
echo "╚═══════════════════════════════════════════╝"

case "$LAYER" in
  --layer)
    case "${2:-}" in
      1) run_l1 ;; 2) run_l2 ;; 3) run_l3 ;; 4) run_l4 ;; 5) run_l5 ;;
      6) run_l6 ;; 7) run_l7 ;; 8) run_l8 ;; 9) run_l9 ;;
      *) echo "Usage: verify.sh --layer [1-9] | --all"; exit 1 ;;
    esac
    ;;
  --all|all)
    run_l1; run_l2; run_l3; run_l4; run_l5; run_l6; run_l7; run_l8; run_l9
    ;;
  *)
    run_l1; run_l2; run_l3; run_l4; run_l5; run_l6; run_l7; run_l8; run_l9
    ;;
esac

# Summary
header "VERIFICATION SUMMARY"
echo -e "  ${GREEN}Passed${NC}: $PASS"
echo -e "  ${RED}Failed${NC}: $FAIL"
echo -e "  ${YELLOW}Skipped${NC}: $SKIP"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}OVERALL: FAIL — $FAIL layer(s) failed${NC}"
  exit 1
else
  echo -e "${GREEN}OVERALL: PASS — All verified layers passed${NC}"
  exit 0
fi
