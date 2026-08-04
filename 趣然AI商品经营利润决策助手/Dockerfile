FROM node:24.18.1-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
RUN npm run build

FROM python:3.12.13-slim@sha256:57cd7c3a7a273101a6485ba99423ee568157882804b1124b4dd04266317710de AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN groupadd --system quran && useradd --system --gid quran --home-dir /app quran
COPY backend/pyproject.toml ./
RUN python -m pip install \
    alembic==1.16.5 \
    fastapi==0.128.8 \
    httpx==0.28.1 \
    openpyxl==3.1.5 \
    'psycopg[binary]==3.2.13' \
    pydantic==2.13.4 \
    pydantic-settings==2.12.0 \
    python-multipart==0.0.22 \
    sqlalchemy==2.0.51 \
    'uvicorn[standard]==0.39.0'
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY --from=frontend-build /build/frontend/dist ./app/static
RUN mkdir -p /var/lib/quran/uploads && chown -R quran:quran /app /var/lib/quran
USER quran
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
