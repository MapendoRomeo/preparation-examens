# ---------------------------------------------------------------------------
# API — Node.js + Express + Prisma
#
# Construction en deux étapes : les dépendances de développement (dont le CLI
# Prisma et TypeScript) servent à compiler, puis sont écartées de l'image finale.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build

WORKDIR /app

# Les manifestes sont copiés seuls pour que la couche d'installation soit
# réutilisée tant que les dépendances ne changent pas.
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
# `prisma generate` produit le client typé à partir du schéma.
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
# `rootDir` vaut la racine du projet : la compilation reproduit l'arborescence
# et produit `dist/src/index.js` (l'API) ainsi que `dist/prisma/seed.js` (le
# script de seed), exécutable en production sans embarquer `tsx`.
RUN npm run build

# ---------------------------------------------------------------------------

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Le CLI Prisma reste nécessaire au démarrage pour appliquer les migrations
# (`prisma migrate deploy`), il est donc réinstallé hors des dépendances de
# développement — mais sans les outils de compilation (TypeScript, Vitest…).
COPY package*.json ./
RUN npm ci --omit=dev \
  && npm install --no-save --no-package-lock prisma@^6.1.0 \
  && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

EXPOSE 4000

# Sonde de disponibilité : l'API expose /api/health.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/src/index.js"]
