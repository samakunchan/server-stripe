# Server Stripe

Il va falloir récupérer les clés API dans le dashboard de Stripe : `pk_xxxx`, `sk_xxxx`.



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

Le serveur sera actif avec cet url : `http://localhost:5002`
