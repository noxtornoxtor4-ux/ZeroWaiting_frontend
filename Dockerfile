FROM node:24-slim

WORKDIR /home/app

COPY . .

RUN npm i -g bun
RUN bun i --ignore-scripts
RUN bun run prepare
RUN bun run build

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE ${PORT}

CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT}"]
