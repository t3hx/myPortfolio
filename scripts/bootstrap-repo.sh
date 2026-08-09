#!/usr/bin/env bash
#
# Applique la convention GitHub partagée à un dépôt : labels, workflows,
# gabarits d'issue. myPortfolio est la référence — ce script y lit l'état
# courant plutôt que d'embarquer une copie qui dériverait en silence.
#
# Usage :
#   scripts/bootstrap-repo.sh t3hx/mon-depot            # affiche le plan
#   scripts/bootstrap-repo.sh t3hx/mon-depot --apply    # exécute
#
# Options :
#   --prefix <nom>   préfixe des titres d'issue (défaut : le nom du dépôt)
#   --apply          exécute réellement ; sans lui, rien n'est modifié
#
# Le script est idempotent : le relancer sur un dépôt déjà conforme ne fait
# rien. Il ne touche JAMAIS aux secrets — `ADD_TO_PROJECT_PAT` se dépose à la
# main (`gh secret set`), le jeton ne doit transiter ni par un script ni par
# l'historique du shell.
set -euo pipefail

SOURCE_REPO="t3hx/myPortfolio"
SOURCE_REF="dev"

# Les 9 labels que GitHub crée d'office et que la convention remplace.
DEFAULT_LABELS=(
  bug enhancement documentation duplicate "good first issue"
  "help wanted" invalid question wontfix
)

# Les deux seuls labels par défaut dont la convention a un équivalent direct :
# on les RENOMME au lieu de les supprimer, pour ne pas rompre l'étiquetage des
# issues et PR qui les portent déjà (un label garde son ID interne au
# renommage ; le supprimer casse l'association pour de bon).
#
# Un `case` plutôt qu'un tableau associatif : macOS est gelé sur bash 3.2, qui
# ne connaît pas `declare -A`. Le script doit tourner sur un Mac vanilla.
rename_target() {
  case "$1" in
    bug)         echo "type:bug"  ;;
    enhancement) echo "type:feat" ;;
    *)           echo ""          ;;
  esac
}

target=""
prefix=""
apply=false

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)  apply=true; shift ;;
    --prefix) prefix="${2:?--prefix attend une valeur}"; shift 2 ;;
    -*)       echo "Option inconnue : $1" >&2; exit 2 ;;
    *)        target="$1"; shift ;;
  esac
done

[ -n "$target" ] || { echo "Usage : $0 <owner/repo> [--prefix <nom>] [--apply]" >&2; exit 2; }

# Par défaut, le nom du dépôt amputé d'un `-app` final : la nomenclature suit le
# produit (`owlog-TK#/`), pas le nom technique du dépôt (`owlog-app`).
[ -n "$prefix" ] || prefix="$(echo "${target##*/}" | sed 's/-app$//')"

run() {
  if [ "$apply" = true ]; then
    "$@"
  else
    printf '  [plan] %s\n' "$*"
  fi
}

echo "Dépôt cible : $target"
echo "Préfixe des titres d'issue : $prefix"
[ "$apply" = true ] || echo "MODE PLAN — rien ne sera modifié. Ajouter --apply pour exécuter."
echo

# --------------------------------------------------------------------------
# 1. Branche d'intégration
#
# La CI partagée se déclenche sur `push: [dev]`. Un dépôt neuf naît avec `main`
# pour seule branche : sans `dev`, le tronc d'intégration n'existe pas et la CI
# ne tournera que sur les PR.
# --------------------------------------------------------------------------
echo "== Branche d'intégration =="
if gh api "repos/$target/git/ref/heads/dev" >/dev/null 2>&1; then
  echo "  dev existe déjà."
else
  default_branch="$(gh api "repos/$target" --jq .default_branch)"
  head_sha="$(gh api "repos/$target/git/ref/heads/$default_branch" --jq .object.sha)"
  echo "  dev absent — création depuis $default_branch."
  run gh api -X POST "repos/$target/git/refs" -f "ref=refs/heads/dev" -f "sha=$head_sha"
  echo "  RAPPEL : passer dev en branche par défaut dans les réglages du dépôt."
fi
echo

# --------------------------------------------------------------------------
# 2. Labels
# --------------------------------------------------------------------------
echo "== Labels =="
existing="$(gh label list --repo "$target" --limit 100 --json name --jq '.[].name')"

for old in bug enhancement; do
  new="$(rename_target "$old")"
  grep -qxF "$old" <<<"$existing" || continue
  if grep -qxF "$new" <<<"$existing"; then
    # Les deux coexistent : renommer échouerait sur un conflit de nom.
    echo "  $old et $new coexistent — vérifier à la main lequel garder."
  else
    echo "  renommage $old -> $new (préserve les associations)"
    run gh label edit "$old" --repo "$target" --name "$new"
  fi
done

echo "  copie de la convention depuis $SOURCE_REPO"
run gh label clone "$SOURCE_REPO" --repo "$target"

for label in "${DEFAULT_LABELS[@]}"; do
  grep -qxF "$label" <<<"$existing" || continue
  # `bug` et `enhancement` viennent d'être renommés : ne pas les supprimer.
  if [ -n "$(rename_target "$label")" ]; then
    continue
  fi
  echo "  suppression du label par défaut : $label"
  run gh label delete "$label" --repo "$target" --yes
done
echo

# --------------------------------------------------------------------------
# 3. Workflows — copiés à l'octet près
#
# L'identité se vérifie ensuite en comparant les SHA de blob git : git étant
# adressé par contenu, deux SHA égaux prouvent des fichiers identiques.
# --------------------------------------------------------------------------
echo "== Workflows =="
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

for wf in ci.yml project-sync.yml; do
  src_sha="$(gh api "repos/$SOURCE_REPO/contents/.github/workflows/$wf?ref=$SOURCE_REF" --jq .sha)"

  # `|| true` ne suffirait pas : sur une 404, gh écrit le corps JSON de l'erreur
  # sur la sortie standard, qui atterrirait dans dst_sha. On teste le code de
  # sortie et on jette la sortie en cas d'échec.
  if ! dst_sha="$(gh api "repos/$target/contents/.github/workflows/$wf?ref=dev" --jq .sha 2>/dev/null)"; then
    dst_sha=""
  fi

  if [ "$src_sha" = "$dst_sha" ]; then
    echo "  $wf déjà identique ($src_sha)"
    continue
  fi

  gh api "repos/$SOURCE_REPO/contents/.github/workflows/$wf?ref=$SOURCE_REF" --jq .content > "$workdir/$wf.b64"
  echo "  $wf à copier (source $src_sha, cible ${dst_sha:-absent})"

  if [ "$apply" = true ]; then
    python3 - "$workdir/$wf.b64" "$wf" "$dst_sha" <<'PY' > "$workdir/payload.json"
import json, sys, pathlib
content = pathlib.Path(sys.argv[1]).read_text().replace("\n", "")
payload = {
    "message": f"ci: adopt the shared {sys.argv[2]} workflow",
    "branch": "dev",
    "content": content,
}
if sys.argv[3]:
    payload["sha"] = sys.argv[3]
json.dump(payload, sys.stdout)
PY
    gh api -X PUT "repos/$target/contents/.github/workflows/$wf" \
      --input "$workdir/payload.json" --jq .commit.sha
  fi
done
echo

# --------------------------------------------------------------------------
# 4. Gabarits d'issue
#
# Contrairement aux workflows, ils sont VOLONTAIREMENT spécifiques au projet :
# le préfixe de titre change, et les champs de contexte devraient être relus à
# la main (un monorepo gagne un menu « paquet concerné », une app web une
# question sur le navigateur). D'où la copie avec substitution, pas l'identité.
# --------------------------------------------------------------------------
echo "== Gabarits d'issue =="
for tpl in bug.yml feature.yml chore.yml idea.yml config.yml; do
  if gh api "repos/$target/contents/.github/ISSUE_TEMPLATE/$tpl?ref=dev" >/dev/null 2>&1; then
    echo "  $tpl existe déjà — laissé tel quel"
    continue
  fi

  gh api "repos/$SOURCE_REPO/contents/.github/ISSUE_TEMPLATE/$tpl?ref=$SOURCE_REF" \
    --jq .content | base64 -d | sed "s/myPortfolio-/${prefix}-/g" > "$workdir/$tpl"
  echo "  $tpl à créer (préfixe ${prefix}-)"

  if [ "$apply" = true ]; then
    python3 - "$workdir/$tpl" "$tpl" <<'PY' > "$workdir/payload.json"
import base64, json, sys, pathlib
json.dump({
    "message": f"chore: add the {sys.argv[2]} issue template",
    "branch": "dev",
    "content": base64.b64encode(pathlib.Path(sys.argv[1]).read_bytes()).decode(),
}, sys.stdout)
PY
    gh api -X PUT "repos/$target/contents/.github/ISSUE_TEMPLATE/$tpl" \
      --input "$workdir/payload.json" --jq .commit.sha
  fi
done
echo

# --------------------------------------------------------------------------
# 5. Ce qui reste à faire à la main
# --------------------------------------------------------------------------
echo "== À faire à la main =="
if gh secret list --repo "$target" --json name --jq '.[].name' 2>/dev/null | grep -qx ADD_TO_PROJECT_PAT; then
  echo "  ✓ ADD_TO_PROJECT_PAT est en place."
else
  echo "  ✗ Déposer le jeton du Project (il est demandé en invite, donc jamais"
  echo "    écrit dans l'historique du shell) :"
  echo "      gh secret set ADD_TO_PROJECT_PAT --repo $target"
fi
echo "  • Relire les champs de contexte des gabarits : ils décrivent encore le"
echo "    portfolio (navigateur, paramètres d'URL) et méritent d'être adaptés."
echo "  • Vérifier que les scripts du package.json existent : la CI appelle"
echo "    lint / type-check / build / test via --if-present, donc un script"
echo "    absent est sauté SANS erreur — une couverture nulle passe au vert."
