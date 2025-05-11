FROM node:18.20.0 AS cache
LABEL maintainer="cedric.badjah@gmail.com"
LABEL build=true

WORKDIR /stripe-container

ENV PATH /stripe/node_modules/.bin:$PATH

COPY package*.json ./

# install node packages
RUN npm set progress=false && npm config set depth 0
RUN npm install

FROM cache as environment
LABEL build=true

# Copy dev environment
COPY . .

FROM environment AS test
LABEL build=true
RUN npm run test:cov


FROM test AS build
LABEL build=true
RUN npm run build


FROM nginx:1.18-alpine AS docker_image

## Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*
WORKDIR /usr/share/nginx/html

COPY --from=build /stripe/dist/stripe-server/ .

ENTRYPOINT ["nginx", "-g", "daemon off;"]
