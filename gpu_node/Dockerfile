FROM pytorch/pytorch:2.1.2-cuda11.8-cudnn8-runtime

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    curl \
    zlib1g \
    libzip5 \
    libzip-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install KataGo (CUDA version for Vast GPU)
WORKDIR /opt/katago
RUN wget -qO katago.zip "https://github.com/lightvector/KataGo/releases/download/v1.15.3/katago-v1.15.3-cuda12.1-cudnn8.9.7-linux-x64.zip" && \
    unzip katago.zip && \
    chmod +x katago && \
    ln -s /opt/katago/katago /usr/local/bin/katago && \
    rm katago.zip

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api_vast:app", "--host", "0.0.0.0", "--port", "8000"]
