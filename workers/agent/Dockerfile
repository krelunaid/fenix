# Agent HOST image (the server, not the sandbox). Needs the Docker socket of the host
# to create sandboxes: run with -v /var/run/docker.sock:/var/run/docker.sock and build the
# sandbox image on the host first (docker build -t fenix-agent-sandbox:local workers/agent/sandbox).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends docker.io ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/fenix
COPY workers/agent ./workers/agent
COPY scripts/fixtures/agent-golden-project.mjs ./scripts/fixtures/agent-golden-project.mjs
ENV AGENT_SANDBOX=docker AGENT_DATA_DIR=/var/lib/fenix-agent PORT=8790 HOST=0.0.0.0
VOLUME ["/var/lib/fenix-agent"]
EXPOSE 8790
CMD ["node", "workers/agent/server.mjs"]
