FROM node:26.5.0-alpine AS build
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY 趣然AI商品经营利润决策助手/output/tokens.css /design/tokens.css
RUN sed -i "s#@import '../../趣然AI商品经营利润决策助手/output/tokens.css';#@import '/design/tokens.css';#" src/styles.css && npm run build

FROM nginx:1.29.4-alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
