# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Upgrade pip and install dependencies with CPU-only PyTorch index and network timeout settings
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --default-timeout=1000 --retries 10 --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# Copy app code
COPY . .

# Expose port for local testing
EXPOSE 8083

# Run app with Gunicorn, binding to $PORT (set by Render)
CMD ["gunicorn", "--bind", "0.0.0.0:8083", "--workers", "2", "--threads", "4", "server:app"]