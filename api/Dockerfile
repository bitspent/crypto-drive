FROM node:20-slim
WORKDIR /srv
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 8081
# Liveness only: HTTP 200 proves the process answers. Downstream outages
# (bitcoind/electrs down) intentionally do NOT fail this — blame stays
# with the functional probes in scripts/status.sh and the boot gates.
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=20s \
  CMD node -e 'fetch("http://localhost:8081/api/health",{headers:{authorization:"Bearer "+(process.env.INFRA_SHARED_SECRET||"dev")}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
CMD ["node", "src/index.js"]
