# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set working directory in the container
WORKDIR /app

# Install system dependencies (build tools, curl for health check)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY . .

# Ensure runtime storage directory exists
RUN mkdir -p resume

# Expose port 8000 for FastAPI (HTTP + WebSocket)
EXPOSE 8000

# Health check to ensure service is responsive
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run FastAPI app with Uvicorn (ASGI server with WebSocket support)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
