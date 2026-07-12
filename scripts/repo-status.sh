#!/usr/bin/env bash
# repo-status.sh - Estado integral del repositorio por ramas
#
# Uso:
#   ./scripts/repo-status.sh             Tabla resumen + estado de trabajo
#   ./scripts/repo-status.sh --timeline  + Timeline combinado de commits por fecha
#   ./scripts/repo-status.sh --all      + Commits por mes y diffs ahead/behind
#
# Sin dependencias externas (solo git + awk + coreutils).
# Salida en texto plano alineado.

set -euo pipefail

# --- Helpers de salida ------------------------------------------------------

# Printf alineado: coloca string a ancho fijo (trunca si excede por seguridad)
# Uso: put_column "texto" ancho
put_column() {
  local text="$1" width="$2"
  local len=${#text}
  if (( len > width )); then
    # Trunca y añade '…'
    text="${text:0:$((width-1))}…"
  fi
  printf "%-${width}s" "$text"
}

separator() {
  echo "$1"
}

# --- Parseo de flags --------------------------------------------------------

FLAG_TIMELINE=0
FLAG_ALL=0
for arg in "$@"; do
  case "$arg" in
    --timeline) FLAG_TIMELINE=1 ;;
    --all)      FLAG_ALL=1; FLAG_TIMELINE=1 ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      echo "Flag no reconocido: $arg" >&2
      exit 2
      ;;
  esac
done

# --- Validación de repositorio ----------------------------------------------

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: no estás dentro de un repositorio git." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE_URL="$(git remote get-url origin 2>/dev/null || echo '(sin remoto origin)')"
TODAY="$(date +%Y-%m-%d)"

# --- Encabezado --------------------------------------------------------------

echo "================================================================"
put_column "REPOSITORIO:" 15;      echo "$REPO_ROOT"
put_column "Remoto:" 15;           echo "$REMOTE_URL"
put_column "Rama activa:" 15;     echo "$CURRENT_BRANCH"
put_column "Reporte generado:" 15; echo "$TODAY"
echo "================================================================"
echo

# --- Recolección de ramas (locales + remotas) -------------------------------

mapfile -t LOCAL_BRANCHES  < <(git for-each-ref --format='%(refname:short)' refs/heads)
mapfile -t REMOTE_BRANCHES < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin)

# --- Tabla resumen por rama --------------------------------------------------

echo "## Tabla resumen por rama"
echo

# Línea de cabecera con anchos fijos
HEADER_FMT="%-20s | %-7s | %-10s | %-12s | %-22s | %s"
ROW_FMT="%-20s | %-7s | %-10s | %-12s | %-22s | %s"

printf "$HEADER_FMT\n" "RAMA" "COMMITS" "ULT.HASH" "FECHA" "AUTOR" "ASUNTO"
printf "%s\n" "---------------------+---------+------------+--------------+------------------------+-------------------------------------------"

print_branch_row() {
  local rama="$1" tipo="$2"
  local info hash fecha autor asunto count
  info="$(git log -1 --format="%H|%ad|%an|%s" --date=short "$rama" 2>/dev/null || true)"
  if [[ -z "$info" ]]; then
    return
  fi
  IFS='|' read -r hash fecha autor asunto <<< "$info"
  count="$(git rev-list --count "$rama" 2>/dev/null || echo '?')"
  local short_hash="${hash:0:9}"
  printf "$ROW_FMT\n" "$rama" "$count" "$short_hash" "$fecha" "$(put_column "$autor" 22)" "$(put_column "$asunto" 43)"
}

# Locales primero
for rama in "${LOCAL_BRANCHES[@]}"; do
  print_branch_row "$rama" "local"
done

printf "%s\n" "---------------------+---------+------------+--------------+------------------------+-------------------------------------------"

# Remotas
for rama in "${REMOTE_BRANCHES[@]}"; do
  # Solo origin/* sin duplicar variables locales
  print_branch_row "$rama" "remoto"
done

echo

# --- Estado de trabajo actual ----------------------------------------------

echo "## Estado de trabajo actual"
echo
git status -s || echo "(limpio o no disponible)"
echo

# --- Flags extendidos ------------------------------------------------------

if (( FLAG_TIMELINE || FLAG_ALL )); then
  echo "## Timeline combinado (commits recientes, todas las ramas)"
  echo
  printf "%-12s | %-20s | %-10s | %s\n" "FECHA" "RAMA" "HASH" "ASUNTO"
  printf "%s\n" "-------------+----------------------+------------+-------------------------------------------"
  git for-each-ref \
      --sort=-committerdate \
      --format='%(committerdate:short)|%(refname:short)|%(objectname:short)|%(subject)' \
      refs/heads refs/remotes/origin \
    | head -n 30 \
    | while IFS='|' read -r fecha rama hash asunto; do
        printf "%-12s | %-20s | %-10s | %s\n" "$fecha" "$(put_column "$rama" 20)" "$hash" "$(put_column "$asunto" 43)"
      done
  echo
fi

if (( FLAG_ALL )); then
  echo "## Commits por mes (por rama)"
  echo
  for rama in "${LOCAL_BRANCHES[@]}"; do
    echo "Rama: $rama"
    git log "$rama" --date=format:'%Y-%m' --format='%ad' 2>/dev/null \
      | awk '{c[$1]++} END {for (m in c) printf "  %-7s  %d commits\n", m, c[m]}' \
      | sort -r
    echo
  done

  echo "## Diferencias entre ramas (ahead/behind vs main)"
  echo
  FOUND_MAIN=0
  for rama in "${LOCAL_BRANCHES[@]}"; do
    if [[ "$rama" == "main" ]]; then FOUND_MAIN=1; fi
  done
  if (( FOUND_MAIN )); then
    printf "%-20s | %-20s | %s\n" "RAMA-A" "RAMA-B" "AHEAD/BEHIND (A...B)"
    printf "%s\n" "-------------+----------------------+------------------------"
    for rama in "${LOCAL_BRANCHES[@]}"; do
      [[ "$rama" == "main" ]] && continue
      local count
      count="$(git rev-list --left-right --count "main...$rama" 2>/dev/null || echo '?')"
      printf "%-20s | %-20s | %s\n" "main" "$rama" "$count"
    done
  else
    echo "(no se encontró rama 'main' localmente)"
  fi
  echo
fi

# --- Pie -------------------------------------------------------------------

echo "================================================================"
echo "Fin del reporte."