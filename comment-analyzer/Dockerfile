FROM python:3.10-slim

WORKDIR /app

# Install system dependencies and DNS tools
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    dnsutils \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Configure DNS to use Google's public DNS (fix for HF Spaces)
RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf && \
    echo "nameserver 8.8.4.4" >> /etc/resolv.conf && \
    echo "options single-request-reopen" >> /etc/resolv.conf

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data for VADER
RUN python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"

# Copy application code
COPY app/ ./app/

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port (Hugging Face uses 7860)
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
