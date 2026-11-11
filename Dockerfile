# Sirve para cualquier hosting que acepte Docker (Fly.io, Railway, Koyeb, un VPS...)
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=8080 \
    SC_DB=/data/smartcustoms.db
EXPOSE 8080
# la carpeta /data debe ser un volumen del hosting para que la base de datos no se pierda
VOLUME ["/data"]
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
