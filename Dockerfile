# Cloudflare Container for A2A Multi-Workflow Server
# Based on Cloudflare Containers template
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml uv.lock* ./

# Install Python dependencies using uv (fast)
RUN pip install uv && uv pip install --system -e .

# Copy application code
COPY a2a_multi_workflow_server.py ./
COPY examples/ ./examples/

# Expose port
EXPOSE 9999

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:9999/ || exit 1

# Run the server
CMD ["python", "a2a_multi_workflow_server.py"]
