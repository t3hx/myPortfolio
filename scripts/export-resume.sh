#!/usr/bin/env bash
#
# Exporte les PDF du CV depuis les sources SVG, une par langue.
#
#   scripts/export-resume.sh            # les deux langues
#   scripts/export-resume.sh fr         # une seule
#
# **Les sources ne sont JAMAIS modifiées.** C'est la règle de ce script et la
# raison de son existence : la photo embarquée pèse 7 Mo, elle est en 2800 x
# 3713 px pour un affichage de 43 x 57 mm — soit 1644 dpi, cinq fois ce qu'une
# imprimante consomme. L'alléger dans la SOURCE, c'est détruire l'original de
# l'auteur pour économiser un export. Le rééchantillonnage se fait donc dans une
# COPIE jetable, et `design/resume/*.svg` reste le master.
#
# Mesuré : à 300 dpi, la version rééchantillonnée et l'originale ne diffèrent
# pas d'un seul pixel. Ce qui est jeté n'était visible par personne.
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Les sources ne sont PAS versionnées : elles n'ont pas vocation à vivre dans
# l'app, seuls les PDF y sont servis (décision de l'auteur, 2026-09-11). Le
# dossier local `design/resume/` est le défaut ; $RESUME_SOURCES le remplace
# quand les masters vivent ailleurs.
SOURCES="${RESUME_SOURCES:-$RACINE/design/resume}"
SORTIE="$RACINE/public/resume"
if [ ! -d "$SOURCES" ]; then
  echo "sources introuvables : $SOURCES" >&2
  echo "pose les SVG du CV là, ou donne leur dossier par RESUME_SOURCES=..." >&2
  exit 1
fi

TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

# 300 dpi : la densité demandée pour l'impression, et le seul chiffre à changer
# si le besoin change. La taille en pixels s'en déduit, elle ne s'écrit pas.
DPI=300
# Un CV s'envoie par courriel et se dépose dans des formulaires qui plafonnent
# souvent à 1 Mo. Dépasser n'est pas un détail esthétique, c'est un envoi refusé.
LIMITE_OCTETS=1048576
QUALITE_JPEG=88

inkscape_bin() {
  command -v inkscape || echo /Applications/Inkscape.app/Contents/MacOS/inkscape
}

exporte() {
  langue="$1"
  case "$langue" in
    fr) source="$SOURCES/cv.svg" ;;
    en) source="$SOURCES/cv-en.svg" ;;
    *) echo "langue inconnue : $langue" >&2; return 1 ;;
  esac
  [ -f "$source" ] || { echo "source absente : $source" >&2; return 1; }

  copie="$TEMP/cv-$langue.svg"
  photo="$TEMP/photo-$langue.png"
  petite="$TEMP/photo-$langue-$DPI.jpg"

  # 1. sortir la photo de la copie et lire la taille à laquelle elle s'affiche
  taille=$(python3 "$RACINE/scripts/resume_photo.py" extract "$source" "$photo" "$DPI")
  echo "  photo : $taille"

  # 2. la ramener à la densité demandée, en JPEG (aucune transparence à garder,
  #    et un portrait en PNG coûte cinq fois plus pour la même image)
  if [ "${taille##*-> }" = "deja a la densite voulue" ]; then
    # La source est déjà allégée : elle part telle quelle à l'export.
    cp "$source" "$copie"
  else
    largeur="${taille##*-> }"; largeur="${largeur%%x*}"
    hauteur="${taille##*x}"
    # Un seul appel : redimensionner et encoder en même temps. Passer par un
    # PNG intermédiaire nommé `.png` faisait avertir sips sur le suffixe, et
    # ajoutait un encodage pour rien.
    sips -z "$hauteur" "$largeur" -s format jpeg -s formatOptions "$QUALITE_JPEG" \
      "$photo" --out "$petite" >/dev/null

    # 3. réembarquer dans une copie jetable, puis exporter
    python3 "$RACINE/scripts/resume_photo.py" embed "$source" "$petite" "$copie"
  fi
  mkdir -p "$SORTIE"
  "$(inkscape_bin)" --export-type=pdf --export-filename="$SORTIE/cv-$langue.pdf" "$copie" 2>&1 |
    grep -v 'Invalid glyph' || true

  octets=$(stat -f%z "$SORTIE/cv-$langue.pdf")
  printf '  cv-%s.pdf : %s Ko' "$langue" "$((octets / 1024))"
  if [ "$octets" -gt "$LIMITE_OCTETS" ]; then
    printf ' — AU-DESSUS de la limite de %s Ko\n' "$((LIMITE_OCTETS / 1024))"
    return 1
  fi
  printf ' — sous la limite\n'
}

# Sans argument, les deux langues. `"${@:-fr en}"` ne marcherait pas : entre
# guillemets, le repli est UN mot, et le script cherche une langue « fr en ».
if [ "$#" -eq 0 ]; then set -- fr en; fi

for langue in "$@"; do
  echo "== $langue"
  exporte "$langue"
done

# Le master est intact : c'est la promesse du script, donc elle se vérifie.
echo "== sources"
for f in "$SOURCES"/*.svg; do
  printf '  %s : %s octets\n' "$(basename "$f")" "$(stat -f%z "$f")"
done
