FROM node:14.20.0 as cache
LABEL maintainer="cedric.badjah@gmail.com"
LABEL build=true

WORKDIR /stripe-container

ENV PATH /stripe/node_modules/.bin:$PATH

COPY package*.json ./

# install node packages
RUN npm set progress=false && npm config set depth 0
RUN npm install

# install nestjs global
RUN npm i -g @nestjs/cli

FROM cache as environment
LABEL build=true

# Copy dev environment
COPY . .

FROM environment as test
LABEL build=true
RUN npm run test:cov


FROM test as build
LABEL build=true
RUN npm run build


FROM nginx:1.18-alpine as docker_image

## Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*
WORKDIR /usr/share/nginx/html

COPY --from=build /stripe/dist/stripe-server/ .

ENTRYPOINT ["nginx", "-g", "daemon off;"]
