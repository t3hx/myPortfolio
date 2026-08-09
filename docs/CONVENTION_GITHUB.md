# Convention GitHub partagée

Trois dépôts, et trois seulement, partagent cette convention : **myPortfolio**,
**owlog-app**, **odysong-app**. `scripts/bootstrap-repo.sh` l'applique à un
dépôt neuf ; ce document explique les décisions qu'il encode.

## Le contrat des workflows

> Le workflow dit **CE QUI** tourne, le `package.json` dit **COMMENT**.

`.github/workflows/ci.yml` et `project-sync.yml` sont **identiques octet pour
octet** dans les trois dépôts. Ce qui rend ça possible : chaque étape passe par
`pnpm run --if-present <script>`, donc un script absent n'est pas une erreur —
l'étape réussit en silence.

Un projet sans linter ni tests et un monorepo qui fait `pnpm -r lint` avec des
tests d'intégration Postgres partagent ainsi le même fichier, sans la moindre
condition dedans.

**Corollaire, à respecter :** toute particularité d'un projet vit dans SES
scripts, jamais dans le workflow. Un garde-fou sur des tests sautés, une base
jetable à démarrer, un ordre de build — tout cela va dans le script `test` ou
`build` du dépôt concerné.

**Le revers, à connaître :** `--if-present` signifie qu'un script absent passe
au **vert**. Une CI verte sur un dépôt sans tests ne prouve rien ; c'est le prix
de la copie sans condition.

### Vérifier l'identité

Git étant adressé par contenu, deux fichiers ont le même SHA de blob si et
seulement si leur contenu est identique — preuve plus forte qu'un diff, qui
laisserait passer une fin de ligne ou un espace insécable :

```sh
for r in myPortfolio owlog-app odysong-app; do
  gh api "repos/t3hx/$r/contents/.github/workflows/ci.yml?ref=dev" --jq .sha
done
```

Trois SHA égaux = convention respectée.

## Les gabarits d'issue sont, eux, spécifiques

Contrairement aux workflows, `.github/ISSUE_TEMPLATE/` est **volontairement
propre à chaque dépôt** : le préfixe de titre suit la nomenclature du produit
(`myPortfolio-TK#/`, `owlog-FEAT#/`), et les champs de contexte utiles diffèrent
— un monorepo gagne un menu « paquet concerné », une app web une question sur le
navigateur.

C'est aussi pourquoi l'idée d'un dépôt central `t3hx/.github` a été écartée :
les gabarits « community health » ne s'héritent que d'un dépôt `.github`
**public** vers des dépôts **publics**, or owlog et odysong sont privés.

Chaque gabarit pose son label automatiquement (`labels: ["type:bug"]`), pour que
le classement se fasse au moment où l'on a le contexte en tête.

## Labels

14 labels : `type:bug|feat|chore|idea`, `blocked`, `needs-decision`,
`good-first-session`, `size:S|M|L|XL`, `priority:P0|P1|P2`. Les 9 labels créés
d'office par GitHub sont supprimés.

**Renommer plutôt que supprimer** quand un label est déjà utilisé : un label
garde son identifiant interne au renommage, donc ses associations aux issues et
PR ; le supprimer les rompt définitivement, et recréer un label du même nom ne
les restaure pas. D'où `bug` → `type:bug` et `enhancement` → `type:feat`.

Les labels sont des objets **par dépôt** — il n'existe pas de label global.
`gh label clone <src> --repo <dst>` copie une convention entière d'un coup.

## Secrets

`ADD_TO_PROJECT_PAT` (jeton personnel, portée `project`) vit dans les **secrets
Actions du dépôt**, pas dans Doppler. Ce sont deux plans distincts : Doppler
alimente l'application *qui tourne* (Dokploy l'injecte au démarrage du
conteneur), le PAT est consommé par le *runner GitHub Actions*, avant qu'une
image existe.

Un compte personnel n'a pas de coffre partagé — le secret se dépose dans chacun
des trois dépôts :

```sh
gh secret set ADD_TO_PROJECT_PAT --repo t3hx/<repo>   # demande la valeur en invite
```

L'invite est le point important : le jeton ne passe ni par l'historique du shell
ni par un fichier.

Sans ce secret, `project-sync.yml` s'arrête proprement sur un `::notice::` — une
CI rouge sur chaque PR pour une raison de configuration ne rend service à
personne.

## Pièges rencontrés

**Le shell d'une étape `run:` est `bash -e`, sans `pipefail`.** Un
`cmd | tee log` renvoie le code de `tee`, donc masque l'échec de `cmd`. Tout
script de CI commence par `set -euo pipefail`.

**Modifier un fichier sous `.github/workflows/` via l'API exige la portée
`workflow`** sur le jeton `gh`, sinon 403 :

```sh
gh auth refresh -h github.com -s workflow
```

**macOS est gelé sur bash 3.2** (Apple refuse la GPLv3) : pas de `declare -A`,
pas de `${var,,}`, pas de `mapfile`. Les scripts d'outillage s'en passent.

**`main` est absent des déclencheurs `push` de `ci.yml`** : `deploy.yml` appelle
la CI via `workflow_call`, l'ajouter la ferait tourner deux fois par fusion.
