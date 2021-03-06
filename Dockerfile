# The Google App Engine Flexible Environment base Docker image can
# also be used on Google Container Engine, or any other Docker host.
# This image is based on Debian Jessie and includes nodejs and npm
# installed from nodejs.org. The source is located in
# https://github.com/GoogleCloudPlatform/nodejs-docker
FROM node

ADD . /app
WORKDIR /app

RUN npm install
ENV PORT=80
ENTRYPOINT ["npm", "start"]