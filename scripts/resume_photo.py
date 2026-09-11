"""Sort la photo d'un CV SVG, ou la réembarque dans une copie.

Séparé du script shell pour une raison simple : la photo est une donnée `base64`
posée dans un attribut XML, et elle contient des entités `&#10;`. Toute lecture
par expression régulière s'arrête au premier `&` et rend 57 octets au lieu de
sept mégaoctets — mesuré. Il faut un vrai analyseur XML.
"""

import base64
import struct
import sys
import xml.etree.ElementTree as ET

NS = {
    '': 'http://www.w3.org/2000/svg',
    'inkscape': 'http://www.inkscape.org/namespaces/inkscape',
    'sodipodi': 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd',
    'xlink': 'http://www.w3.org/1999/xlink',
}
for prefixe, uri in NS.items():
    ET.register_namespace(prefixe, uri)
SVG = '{%s}' % NS['']
XLINK = '{%s}' % NS['xlink']
MM_PAR_POUCE = 25.4


def dimensions(données):
    """La taille en pixels d'un PNG ou d'un JPEG, lue dans ses octets.

    Les deux formats se croisent ici : la photo arrive en PNG du master, et
    repart en JPEG dans la source allégée. Lire l'en-tête PNG dans un JPEG rend
    des nombres absurdes — mesuré, 4718592 x 4292935878 — et le garde-fou
    d'idempotence conclut alors qu'il faut rééchantillonner une image déjà
    rééchantillonnée, ce qui la ré-encode à chaque export.
    """
    if données[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', données[16:24])
    if données[:2] == b'\xff\xd8':
        i = 2
        while i < len(données) - 9:
            if données[i] != 0xFF:
                i += 1
                continue
            marqueur = données[i + 1]
            # SOF0 à SOF3, SOF5 à SOF7, SOF9 à SOF11, SOF13 à SOF15 : les seuls
            # segments qui portent la taille de l'image.
            if marqueur in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                            0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                hauteur, largeur = struct.unpack('>HH', données[i + 5:i + 9])
                return largeur, hauteur
            if marqueur in (0xD8, 0xD9) or 0xD0 <= marqueur <= 0xD7:
                i += 2
                continue
            i += 2 + struct.unpack('>H', données[i + 2:i + 4])[0]
    raise SystemExit('format d\'image inconnu dans le SVG')


def image(racine):
    """Le premier `<image>` du document — la photo d'identité."""
    return next(racine.iter(SVG + 'image'))


def extract(source, sortie, dpi):
    racine = ET.parse(source).getroot()
    img = image(racine)
    href = img.get(XLINK + 'href') or img.get('href')
    données = base64.b64decode(''.join(href.split(',', 1)[1].split()))
    open(sortie, 'wb').write(données)
    largeur, hauteur = dimensions(données)
    # La densité utile se déduit de la taille D'AFFICHAGE, jamais de la taille en
    # pixels : c'est le millimètre imprimé qui décide, pas le fichier.
    mm_l, mm_h = float(img.get('width')), float(img.get('height'))
    cible_l = round(mm_l / MM_PAR_POUCE * int(dpi))
    cible_h = round(mm_h / MM_PAR_POUCE * int(dpi))
    actuel = round(largeur / (mm_l / MM_PAR_POUCE))
    # Déjà à la densité voulue : on ne touche à rien. Ré-encoder un JPEG à
    # chaque export le dégraderait un peu plus à chaque fois, et une source
    # allégée une fois n'a aucune raison de repasser par l'encodeur.
    if largeur <= cible_l:
        print(f'{largeur}x{hauteur} px ({actuel} dpi) -> deja a la densite voulue')
        return
    print(f'{largeur}x{hauteur} px ({actuel} dpi) -> {cible_l}x{cible_h}')


def embed(source, photo, sortie):
    arbre = ET.parse(source)
    img = image(arbre.getroot())
    jpeg = base64.b64encode(open(photo, 'rb').read()).decode()
    img.set(XLINK + 'href', 'data:image/jpeg;base64,' + jpeg)
    arbre.write(sortie, encoding='utf-8', xml_declaration=True)


if __name__ == '__main__':
    if sys.argv[1] == 'extract':
        extract(*sys.argv[2:5])
    elif sys.argv[1] == 'embed':
        embed(*sys.argv[2:5])
    else:
        raise SystemExit(f'action inconnue : {sys.argv[1]}')
