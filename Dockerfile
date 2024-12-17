FROM node:21.5.0-alpine3.19 as base


#STAGE 1 - BUILD

# Puppeteer requires additional dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

FROM base as builder

WORKDIR /home/build

COPY nodemon.json .
COPY firebaseAdminSDK.json .
COPY tsconfig.json .
COPY package*.json .
COPY prisma/ prisma/
RUN npm install 
COPY .env .env
COPY templates/ templates/

COPY src/ src/

RUN npm run build


#STAGE 2 : Runner
FROM base as runner

WORKDIR /home/server

COPY --from=builder /home/build/dist dist/
COPY --from=builder /home/build/package*.json .
COPY --from=builder /home/build/.env .
COPY --from=builder /home/build/firebaseAdminSDK.json .
COPY --from=builder /home/build/prisma prisma/
COPY --from=builder /home/build/templates templates/


RUN npm install --omit=dev
RUN npm install pm2 -g
RUN npx prisma generate


CMD ["npm","run","dev"]
