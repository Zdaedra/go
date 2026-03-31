FROM python:3.11-slim
WORKDIR /app

# Install explicit FastAPI and KataGo process manager dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download KataGo Engine Binary (Pinned: v1.15.3 Linux x64) with SHA256 validation
RUN apt-get update && apt-get install -y wget unzip sudo bash && \
    wget -qO katago.zip "https://github.com/lightvector/KataGo/releases/download/v1.15.3/katago-v1.15.3-cuda12.1-cudnn8.9.7-linux-x64.zip" && \
    echo "40a9dbe7b73380c66de6ef97fe9196f8192428ad2f5c804db5bacd11f7d9e5b4  katago.zip" | sha256sum -c - && \
    unzip -o katago.zip && chmod +x katago && rm katago.zip

# Download Official Neural Network Weights (Self-Contained)
RUN wget -qO network.bin.gz "https://github.com/lightvector/KataGo/releases/download/v1.15.0/b18c384nbt-humanv0.bin.gz"

COPY . /app/
EXPOSE 8080

# Pinned explicit import path for Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
