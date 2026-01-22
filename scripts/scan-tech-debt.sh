#!/bin/bash
#
# Technical Debt Scanner
# Scans the codebase for TODO, FIXME, HACK, and other debt markers
# Usage: ./scripts/scan-tech-debt.sh [--json] [--fail-on-threshold N]
#

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

OUTPUT_JSON=false
THRESHOLD=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            OUTPUT_JSON=true
            shift
            ;;
        --fail-on-threshold)
            THRESHOLD="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--json] [--fail-on-threshold N]"
            echo ""
            echo "Options:"
            echo "  --json                 Output results as JSON"
            echo "  --fail-on-threshold N  Exit with error if debt markers exceed N"
            echo "  -h, --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

cd "$PROJECT_ROOT"

MARKERS=("TODO" "FIXME" "HACK" "XXX" "BUG" "OPTIMIZE" "REFACTOR")

declare -A COUNTS
TOTAL=0

for marker in "${MARKERS[@]}"; do
    count=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.md" "$marker:" . 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "tech-debt" | wc -l || echo 0)
    count=$(echo "$count" | tr -d ' ')
    COUNTS[$marker]=$count
    TOTAL=$((TOTAL + count))
done

DETAILS=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.md" -E "(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REFACTOR):" . 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "tech-debt" || true)

if [ "$OUTPUT_JSON" = true ]; then
    echo "{"
    echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
    echo "  \"total\": $TOTAL,"
    echo "  \"markers\": {"
    first=true
    for marker in "${MARKERS[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        echo -n "    \"$marker\": ${COUNTS[$marker]}"
    done
    echo ""
    echo "  },"
    echo "  \"items\": ["
    if [ -n "$DETAILS" ]; then
        first=true
        while IFS= read -r line; do
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            file=$(echo "$line" | cut -d: -f1)
            line_num=$(echo "$line" | cut -d: -f2)
            content=$(echo "$line" | cut -d: -f3- | sed 's/"/\\"/g' | sed 's/\t/ /g')
            echo -n "    {\"file\": \"$file\", \"line\": $line_num, \"content\": \"$content\"}"
        done <<< "$DETAILS"
        echo ""
    fi
    echo "  ]"
    echo "}"
else
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}              Technical Debt Scanner Report${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Scan date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo ""
    echo -e "${YELLOW}Summary by Marker Type:${NC}"
    echo "─────────────────────────────────────────"
    printf "%-12s %s\n" "Marker" "Count"
    echo "─────────────────────────────────────────"
    for marker in "${MARKERS[@]}"; do
        count=${COUNTS[$marker]}
        if [ "$count" -gt 0 ]; then
            printf "${RED}%-12s %s${NC}\n" "$marker" "$count"
        else
            printf "${GREEN}%-12s %s${NC}\n" "$marker" "$count"
        fi
    done
    echo "─────────────────────────────────────────"
    if [ "$TOTAL" -gt 0 ]; then
        echo -e "${RED}Total:       $TOTAL${NC}"
    else
        echo -e "${GREEN}Total:       $TOTAL${NC}"
    fi
    echo ""

    if [ -n "$DETAILS" ]; then
        echo -e "${YELLOW}Detailed List:${NC}"
        echo "─────────────────────────────────────────"
        echo "$DETAILS"
        echo ""
    else
        echo -e "${GREEN}No technical debt markers found!${NC}"
    fi
fi

if [ "$THRESHOLD" -gt 0 ] && [ "$TOTAL" -gt "$THRESHOLD" ]; then
    echo -e "${RED}ERROR: Technical debt ($TOTAL markers) exceeds threshold ($THRESHOLD)${NC}" >&2
    exit 1
fi

exit 0
