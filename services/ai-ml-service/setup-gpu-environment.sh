#!/bin/bash

# GPU Environment Setup Script for Threat Detection Models
# This script sets up NVIDIA Docker toolkit and CUDA support

set -e

echo "🚀 Setting up GPU environment for ML model training and inference..."

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    echo "✅ Running with root privileges"
else
    echo "❌ This script requires sudo privileges"
    echo "Usage: sudo ./setup-gpu-environment.sh"
    exit 1
fi

# Function to check command success
check_success() {
    if [ $? -eq 0 ]; then
        echo "✅ $1"
    else
        echo "❌ $1 failed"
        exit 1
    fi
}

# 1. Check NVIDIA GPU availability
echo "📋 Checking NVIDIA GPU availability..."
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi
    check_success "NVIDIA GPU detected"
else
    echo "❌ NVIDIA GPU or drivers not found"
    exit 1
fi

# 2. Check Docker installation
echo "📋 Checking Docker installation..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed: $(docker --version)"
else
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# 3. Add NVIDIA package repository
echo "📦 Adding NVIDIA Container Toolkit repository..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
check_success "NVIDIA GPG key added"

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/$(dpkg --print-architecture)/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
check_success "NVIDIA repository added"

# 4. Update package list
echo "🔄 Updating package list..."
apt-get update
check_success "Package list updated"

# 5. Install NVIDIA Container Toolkit
echo "📦 Installing NVIDIA Container Toolkit..."
apt-get install -y nvidia-container-toolkit
check_success "NVIDIA Container Toolkit installed"

# 6. Configure Docker to use NVIDIA runtime
echo "🔧 Configuring Docker for NVIDIA runtime..."
nvidia-ctk runtime configure --runtime=docker
check_success "Docker configured for NVIDIA runtime"

# 7. Restart Docker service
echo "🔄 Restarting Docker service..."
systemctl restart docker
check_success "Docker service restarted"

# 8. Test NVIDIA Docker setup
echo "🧪 Testing NVIDIA Docker setup..."
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
check_success "NVIDIA Docker setup test"

# 9. Install additional CUDA development tools
echo "📦 Installing CUDA development tools..."
apt-get install -y cuda-toolkit-12-0
check_success "CUDA development tools installed"

# 10. Install cuDNN (Deep Neural Network library)
echo "📦 Installing cuDNN..."
apt-get install -y libcudnn8 libcudnn8-dev
check_success "cuDNN installed"

# 11. Install TensorRT (optional, for optimized inference)
echo "📦 Installing TensorRT..."
apt-get install -y tensorrt
check_success "TensorRT installed"

# 12. Set up environment variables
echo "🔧 Setting up environment variables..."
cat >> /etc/environment << EOF
CUDA_HOME=/usr/local/cuda
PATH=/usr/local/cuda/bin:\$PATH
LD_LIBRARY_PATH=/usr/local/cuda/lib64:\$LD_LIBRARY_PATH
EOF
check_success "Environment variables configured"

# 13. Create GPU monitoring script
echo "📊 Creating GPU monitoring script..."
cat > /usr/local/bin/gpu-monitor << 'EOF'
#!/bin/bash
# GPU Monitoring Script
echo "=== GPU Status ==="
nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits

echo -e "\n=== GPU Processes ==="
nvidia-smi --query-compute-apps=pid,process_name,gpu_uuid,used_memory --format=csv,noheader

echo -e "\n=== Docker GPU Containers ==="
docker ps --filter "label=nvidia.com/gpu" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
EOF

chmod +x /usr/local/bin/gpu-monitor
check_success "GPU monitoring script created"

# 14. Test final setup
echo "🎯 Final GPU setup verification..."
echo "NVIDIA Driver Version: $(nvidia-smi --query-gpu=driver_version --format=csv,noheader,nounits | head -n1)"
echo "CUDA Version: $(nvcc --version | grep "release" | sed 's/.*release //' | sed 's/,.*//')"
echo "Docker GPU Support: $(docker info 2>/dev/null | grep -i nvidia || echo 'Not configured')"

# Create a test script for ML frameworks
echo "🧪 Creating ML framework test script..."
cat > /opt/projects/projects/threat-modeling-application/services/ai-ml-service/test-gpu-ml.py << 'EOF'
#!/usr/bin/env python3
"""
GPU ML Framework Test Script
Tests TensorFlow and PyTorch GPU availability
"""

import sys

def test_tensorflow_gpu():
    try:
        import tensorflow as tf
        print(f"TensorFlow version: {tf.__version__}")
        
        # List physical devices
        gpus = tf.config.experimental.list_physical_devices('GPU')
        print(f"TensorFlow GPU devices: {len(gpus)}")
        
        for i, gpu in enumerate(gpus):
            print(f"  GPU {i}: {gpu}")
            
        # Test GPU computation
        if gpus:
            with tf.device('/GPU:0'):
                a = tf.constant([[1.0, 2.0], [3.0, 4.0]])
                b = tf.constant([[1.0, 1.0], [0.0, 1.0]])
                c = tf.matmul(a, b)
                print(f"TensorFlow GPU computation test: {c.numpy()}")
                return True
        else:
            print("No TensorFlow GPU devices found")
            return False
            
    except ImportError:
        print("TensorFlow not installed")
        return False
    except Exception as e:
        print(f"TensorFlow GPU test failed: {e}")
        return False

def test_pytorch_gpu():
    try:
        import torch
        print(f"PyTorch version: {torch.__version__}")
        
        # Check CUDA availability
        cuda_available = torch.cuda.is_available()
        print(f"PyTorch CUDA available: {cuda_available}")
        
        if cuda_available:
            device_count = torch.cuda.device_count()
            print(f"PyTorch CUDA devices: {device_count}")
            
            for i in range(device_count):
                device_name = torch.cuda.get_device_name(i)
                print(f"  GPU {i}: {device_name}")
                
            # Test GPU computation
            device = torch.device('cuda:0')
            a = torch.tensor([[1.0, 2.0], [3.0, 4.0]], device=device)
            b = torch.tensor([[1.0, 1.0], [0.0, 1.0]], device=device)
            c = torch.matmul(a, b)
            print(f"PyTorch GPU computation test: {c.cpu().numpy()}")
            return True
        else:
            print("PyTorch CUDA not available")
            return False
            
    except ImportError:
        print("PyTorch not installed")
        return False
    except Exception as e:
        print(f"PyTorch GPU test failed: {e}")
        return False

def main():
    print("🧪 Testing ML Framework GPU Support\n")
    
    tf_result = test_tensorflow_gpu()
    print()
    pt_result = test_pytorch_gpu()
    
    print(f"\n📊 Results:")
    print(f"TensorFlow GPU: {'✅ Working' if tf_result else '❌ Not working'}")
    print(f"PyTorch GPU: {'✅ Working' if pt_result else '❌ Not working'}")
    
    if tf_result or pt_result:
        print("\n🎉 GPU ML frameworks are ready!")
        return 0
    else:
        print("\n⚠️ No GPU ML frameworks detected")
        return 1

if __name__ == "__main__":
    sys.exit(main())
EOF

chmod +x /opt/projects/projects/threat-modeling-application/services/ai-ml-service/test-gpu-ml.py
check_success "ML framework test script created"

echo ""
echo "🎉 GPU environment setup completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Log out and log back in (or run 'source /etc/environment')"
echo "2. Test GPU setup: docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi"
echo "3. Monitor GPU usage: gpu-monitor"
echo "4. Test ML frameworks: python3 /opt/projects/projects/threat-modeling-application/services/ai-ml-service/test-gpu-ml.py"
echo ""
echo "🔧 Configuration files created:"
echo "  - /etc/apt/sources.list.d/nvidia-container-toolkit.list"
echo "  - /usr/local/bin/gpu-monitor"
echo "  - /opt/projects/projects/threat-modeling-application/services/ai-ml-service/test-gpu-ml.py"
echo ""
echo "📊 Current GPU Status:"
nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv