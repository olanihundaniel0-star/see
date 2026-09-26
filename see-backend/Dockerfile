FROM python:3.14-slim
# NOTE: pin base image to an immutable digest for reproducible/secure builds, e.g.:
# FROM python:3.14-slim@sha256:<digest>

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN useradd -m app && chown -R app /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY . /app
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh && chown -R app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/health/live')"

CMD ["./start.sh"]
