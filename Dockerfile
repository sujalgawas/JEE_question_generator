# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies first
# This improves Docker build cache efficiency
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code to the container
COPY . .

# Cloud Run automatically sets the PORT environment variable to 8080.
# We don't need to EXPOSE it explicitly, but it's good practice for local testing.
# EXPOSE 8080

# Command to run the application using Gunicorn
# 'server:app' means Gunicorn will look for the 'app' object in 'server.py'
# --bind 0.0.0.0:${PORT} tells Gunicorn to listen on the port provided by Cloud Run
# --workers: Adjust based on your CPU cores (2 * CPU_cores + 1 is a common formula). Start with 2-4.
# --threads: Increase if your app benefits from concurrency within workers.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--threads", "4", "server:app"]