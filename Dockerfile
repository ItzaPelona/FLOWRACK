FROM python:3.11-slim

WORKDIR /app

COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
COPY database/ /app/database
COPY requirements.txt .
COPY .env /app/.env

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "-m", "backend.app"]

