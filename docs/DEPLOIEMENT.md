# Mise en ligne

Le portfolio se déploie sur **fusion vers `main`**. Rien n'est jamais construit
sur le VPS.

```
PR dev → main (merge commit)
        │
        ├─ verify          ci.yml appelée, pas dupliquée — CI rouge = rien ne part
        ├─ build-and-push  buildx → ghcr.io/t3hx/myportfolio:latest (+ tag SHA)
        └─ deploy          tailnet → POST Dokploy /api/application.deploy
```

`main` est la branche déployée ; `dev` reste le tronc où tout arrive.
**La PR `dev` → `main` se fusionne en _merge commit_, jamais en squash** : un
squash réécrit les SHA et fait diverger les deux troncs définitivement.

## Ce qu'il faut mettre en place une seule fois

### 1. L'application Dokploy

Le panneau est sur le tailnet : **http://100.72.212.99:3000** (`sovereign-vps`,
retrouvable par `tailscale status`). C'est la valeur de `DOKPLOY_URL`.

Dans le panneau : créer une application, puis dans son onglet **General**,
régler **`Source Type` sur `Docker`** — et non `Git`/`GitHub`, qui ferait
construire Dokploy alors que l'image est déjà construite par Actions.

| Champ                     | Valeur                            |
| ------------------------- | --------------------------------- |
| Source Type               | **`Docker`**                      |
| Docker Image              | `ghcr.io/t3hx/myportfolio:latest` |
| Port (onglet **Domains**) | `80`                              |

Puis **Save**, **Deploy**, et l'onglet **Domains** pour attacher le domaine.

**L'`applicationId` se lit dans l'URL du panneau** une fois l'application
ouverte : `.../services/application/<applicationId>`. C'est la valeur de
`DOKPLOY_APP_ID`.

**La clé d'API (`DOKPLOY_TOKEN`) se génère dans les réglages du compte.** Le
chemin exact dépend de la version de Dokploy et n'est documenté nulle part en
amont — le panneau expose sa propre API sous `/swagger`, une fois connecté,
qui fait foi pour la version installée.

### 2. Rendre le paquet GHCR tirable

Le paquet publié par Actions est **privé par défaut**, et Dokploy échouera à le
tirer sans y avoir accès. Deux façons :

- **le passer en public** (`ghcr.io/t3hx/myportfolio` → _Package settings_ →
  _Change visibility_). C'est le plus simple, et sans conséquence : l'image ne
  contient que le site public, aucun secret — c'est même une propriété du
  Dockerfile, qui ne reçoit aucun `build-arg` ;
- ou **déclarer un identifiant de registre dans Dokploy** avec un PAT en
  lecture de paquets.

### 3. Les cinq secrets Actions

```sh
gh secret set DOKPLOY_URL        --repo t3hx/myPortfolio   # https://<panneau>.<tailnet>
gh secret set DOKPLOY_TOKEN      --repo t3hx/myPortfolio   # clé d'API Dokploy
gh secret set DOKPLOY_APP_ID     --repo t3hx/myPortfolio   # applicationId relevé ci-dessus
gh secret set TS_OAUTH_CLIENT_ID --repo t3hx/myPortfolio
gh secret set TS_OAUTH_SECRET    --repo t3hx/myPortfolio
```

Les deux derniers sont ceux du tailnet : **le panneau Dokploy n'est pas joignable
depuis l'internet ouvert**, aucun port web n'est ouvert en entrée sur le VPS. Le
runner s'y raccorde le temps du job. Sans eux, le `curl` de déploiement
n'atteindrait jamais rien. Ils sont les mêmes que ceux d'`owlog-app`.

### 4. La première mise en ligne

`main` est resté un squelette de projet pendant tout le développement. La
première PR `dev` → `main` rattrape donc l'écart d'un coup, et c'est elle qui
déclenche le premier déploiement.

## Les secrets applicatifs

Le portfolio est **entièrement statique** : aucune variable d'environnement au
runtime, aucun secret dans l'image, aucun `build-arg`. Doppler n'a donc rien à
injecter ici, contrairement à `owlog-app` dont le front consomme un jeton
partagé. Si un jour un formulaire de contact arrive, ce sera par Doppler →
Dokploy, jamais par un secret d'Actions ni par une valeur cuite dans l'image.

## Le VPS tire, il ne construit jamais — et c'est vérifié

`build-and-push` construit sur GitHub, Dokploy **tire** l'image. L'application
doit donc être en `Source Type: Docker`, jamais en `Github`.

Ce n'est pas une consigne mais un test : après l'appel de déploiement, le
workflow interroge `GET /api/application.one` et **échoue** si `sourceType`
n'est pas `docker`, ou si `dockerImage` n'est pas l'image qu'il vient de
pousser.

Pourquoi ce garde-fou existe : chez `owlog-app`, l'application était configurée
en provider `Github`. Dokploy clonait le dépôt et **construisait sur le serveur
de production**, pendant que le workflow poussait consciencieusement des images
sur GHCR que personne ne tirait. Trois semaines, sans que rien ne le signale —
l'appel de déploiement répond `200` dans les deux cas. Corrigé le 2026-08-20.

Le critère qui fait foi est le journal de déploiement Dokploy : on doit y lire
`Pulling`, jamais `Building` ni `Receiving objects`.

## Ce que ce workflow ne vérifie pas, volontairement

La santé de l'application est contrôlée **par Dokploy** — healthcheck du
conteneur et rollback automatique — et non par une sonde depuis le runner :
celle-ci passerait par Cloudflare, qui répond `403` aux IP de datacenter. Un
faux négatif qui ne dirait rien de l'app.

Le garde-fou du workflow est ailleurs : `curl --fail-with-body`. Dokploy qui
refuse rend le job rouge, avec sa réponse dans le journal. Sans ce drapeau,
`curl` sort en `0` sur un `500` et la mise en ligne échoue en silence.
