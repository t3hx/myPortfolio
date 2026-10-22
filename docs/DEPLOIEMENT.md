# Mise en ligne

Le portfolio est **trunk-based** depuis le 2026-10-22 : une seule branche longue,
`main`, et **chaque PR fusionnée part en prod**. Rien n'est jamais construit sur
le VPS.

```
PR vers main ──▶ verify (lint, types, tests, build)

fusion (squash) dans main
        │
        ├─ verify     pipeline commun — CI rouge = rien ne part
        ├─ version    semver calculé depuis le titre de la PR (Conventional Commits)
        ├─ image      ghcr.io/t3hx/myportfolio:latest + :vX.Y.Z + :main-<sha>
        ├─ deploy     tailnet → webhook Dokploy → /version.json vérifié à l'origine
        └─ release    tag git + GitHub Release, SEULEMENT si la prod sert la version
```

Le pipeline vit dans [`t3hx/workflows`](https://github.com/t3hx/workflows), partagé
par tous les projets ; `.github/workflows/ci.yml` ne fait que l'appeler, par son
tag `v1`. **Il se modifie là-bas, jamais ici.** `render-diff.yml` reste propre à
ce dépôt.

Les PR se fusionnent en **squash** : le titre de la PR devient le commit sur
`main` et décide de la version (`fix:` → patch, `feat:` → minor, `feat!:` →
major ; la toute première release est `v1.0.0`). **Une Release publiée = la
prod sert cette version**, par construction.

## Ce qu'il faut mettre en place une seule fois

### 1. L'application Dokploy

Le panneau est sur le tailnet : **http://100.72.212.99:3000** (`sovereign-vps`,
retrouvable par `tailscale status`).

Dans le panneau : créer une application, puis dans son onglet **General**,
régler **`Source Type` sur `Docker`** — et non `Git`/`GitHub`, qui ferait
construire Dokploy alors que l'image est déjà construite par Actions.

| Champ                     | Valeur                            |
| ------------------------- | --------------------------------- |
| Source Type               | **`Docker`**                      |
| Docker Image              | `ghcr.io/t3hx/myportfolio:latest` |
| Port (onglet **Domains**) | `80`                              |

Puis **Save**, **Deploy**, et l'onglet **Domains** pour attacher le domaine.

### 2. Rendre le paquet GHCR tirable

Le paquet publié par Actions est **privé par défaut**, et Dokploy échouera à le
tirer sans y avoir accès. Deux façons :

- **le passer en public** (`ghcr.io/t3hx/myportfolio` → _Package settings_ →
  _Change visibility_). C'est le plus simple, et sans conséquence : l'image ne
  contient que le site public, aucun secret — son seul `build-arg` est le
  numéro de version ;
- ou **déclarer un identifiant de registre dans Dokploy** avec un PAT en
  lecture de paquets.

### 3. Les secrets et variables Actions

```sh
gh secret set TS_OAUTH_CLIENT_ID       --repo t3hx/myPortfolio
gh secret set TS_OAUTH_SECRET          --repo t3hx/myPortfolio
gh secret set DOKPLOY_PROD_WEBHOOK_URL --repo t3hx/myPortfolio   # Dokploy → app → Deployments → Webhook URL
gh variable set PROD_URL         --repo t3hx/myPortfolio --body "https://<domaine du portfolio>"
gh variable set VPS_TAILSCALE_IP --repo t3hx/myPortfolio --body "100.72.212.99"
```

Les deux premiers sont ceux du tailnet : **le panneau Dokploy n'est pas joignable
depuis l'internet ouvert**, aucun port web n'est ouvert en entrée sur le VPS. Le
runner s'y raccorde le temps du job. L'ACL Tailscale de `tag:ci` doit autoriser
le VPS sur les ports 80 et 443.

Ils sont posés **au niveau du dépôt**, pas dans un environnement GitHub : le
pipeline commun n'utilise pas d'environnement et ne les verrait pas.

## Les secrets applicatifs

Le portfolio est **entièrement statique** : aucune variable d'environnement au
runtime, aucun secret dans l'image. Doppler n'a donc rien à injecter ici,
contrairement à `owlog-app` dont le front consomme un jeton partagé. Si un jour
un formulaire de contact arrive, ce sera par Doppler → Dokploy, jamais par un
secret d'Actions ni par une valeur cuite dans l'image.

## La preuve de mise en ligne

Le `Dockerfile` écrit `dist/version.json` à partir du build-arg `APP_VERSION`.
Après le webhook, le pipeline interroge ce fichier jusqu'à 5 minutes : si la
prod ne sert pas la version qu'il vient de construire, **le job échoue** et
aucune Release n'est publiée. Un webhook qui répond `200` sans rien déployer ne
passe pas inaperçu.

La vérification se fait **à l'origine, par le tailnet** (`--resolve
<domaine>:80:$VPS_TAILSCALE_IP`, directement sur Traefik) : Cloudflare, qui
proxifie la prod, répond `403` aux IP de datacenter des runners.

## Le VPS tire, il ne construit jamais — et c'est vérifié

Le pipeline construit sur GitHub, Dokploy **tire** l'image. L'application doit
donc être en `Source Type: Docker`, jamais en `Github`.

Pourquoi ce garde-fou existe : chez `owlog-app`, l'application était configurée
en provider `Github`. Dokploy clonait le dépôt et **construisait sur le serveur
de production**, pendant que le workflow poussait des images sur GHCR que
personne ne tirait. Trois semaines, sans que rien ne le signale. Corrigé le
2026-08-20.

La preuve `version.json` attrape cette dérive à elle seule : un build fait par
Dokploy ne reçoit pas `APP_VERSION`, sert donc `dev` au lieu de `vX.Y.Z`, et le
job échoue. Le critère qui fait foi reste le journal de déploiement Dokploy : on
doit y lire `Pulling`, jamais `Building` ni `Receiving objects`.

## Revenir en arrière

Dans Dokploy, remplacer `:latest` par la version saine (`:vX.Y.Z`) et
**Deploy**. **Remettre `:latest` avant de fusionner le correctif** : sinon le
webhook redéploie la version épinglée, la vérification échoue et aucune Release
n'est publiée.
