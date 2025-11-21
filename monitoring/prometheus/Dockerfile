FROM prom/prometheus:latest

WORKDIR /etc/prometheus

COPY prometheus.yml /etc/prometheus/prometheus.yml
CMD ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.retention.time=15d"]