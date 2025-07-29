# Server Stripe
Server Stripe perso afin de tester Stripe en totalité. <br>
Il va falloir récupérer les clés API dans le dashboard de Stripe : `pk_xxxx`, `sk_xxxx` (optionnel : `whsec_2cxxxxx` pour un webhook).

## Informations
### Methode GET
- `/`: Juste pour vérifier si le serveur est fonctionnement.
- `/products`: Liste les produits. Les produits doivent être créer depuis le Stripe dashboard.
- `/subscriptions`: Liste les abonnements actifs.
### Methode POST
- `/create-subscription`: Créer l'abonnement
- `/cancel-subscription`: Annule l'abonnement partiellement. Elle sera définitive à la date d'échéance sauf si `cancelImmediately: true` est fournis dans le body.
- `/restore-subscription`: Restore les abonnements partiels uniquement. Les abonnements définitifs impossible.
- `/create-payment-intent`: Sert à afficher la feuille de paiment pour les transactions classiques **(pas utilise en mobile, à retester en web)**.

## Installation

```shell
cp .env.example .env
```
Puis remplir les valeurs de `.env` avec les clés A.P.I.

```shell
yarn install
```

## Lancer le server (local)

```shell
yarn start
```

Le serveur sera actif avec cet url : `http://localhost:5001`

## Lancer le server (docker)

```shell
docker compose up -d
```

Le serveur sera actif avec cet url : `http://localhost:5003`

## Lancer le webhook (local)

```shell
yarn webhook
```

Le serveur webhook sera actif avec cet url : `http://localhost:5002`
