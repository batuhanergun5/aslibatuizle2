FROM node:24-bookworm-slim
WORKDIR /app
COPY public ./public
COPY *.mjs ./
RUN mkdir /data && chown node:node /data
USER node
ENV DATA_DIR=/data BIND_HOST=0.0.0.0 PORT=3000
CMD ["node","server.mjs"]
