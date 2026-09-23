# ---------------------------------------------------------------------------
# Interface — React + Vite, servie par nginx
#
# `VITE_API_URL` est une variable de COMPILATION : Vite l'inscrit en dur dans le
# bundle. Elle est donc passée en argument de construction, pas en variable
# d'exécution.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runtime

# Configuration SPA : toute route inconnue est renvoyée vers index.html, sans
# quoi un rechargement sur /modules/... produirait une 404.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
