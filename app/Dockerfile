# Build context is the repo root (see docker-compose.yml)
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY e2e/package.json e2e/
COPY android-plugin/ android-plugin/
RUN npm ci --no-audit --no-fund
COPY app app
RUN npm run build -w app

FROM nginx:1.27-alpine
COPY --from=build /repo/app/dist /usr/share/nginx/html
RUN printf 'server { listen 80; root /usr/share/nginx/html; location / { try_files $uri /index.html; } }\n' > /etc/nginx/conf.d/default.conf
