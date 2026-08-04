FROM golang:1.26.5-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
ARG TARGET=api
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/service ./cmd/${TARGET}

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/service /app/service
USER nonroot:nonroot
ENTRYPOINT ["/app/service"]
