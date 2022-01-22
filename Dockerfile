FROM ghcr.io/modfy/pnpm:6
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./
RUN pnpm i
COPY . .

ARG APP_ID
ARG PRIVATE_KEY
ARG WEBHOOK_SECRET
ARG PORT

RUN pnpm build
ENV NODE_ENV="production"
CMD [ "npm", "start" ]

