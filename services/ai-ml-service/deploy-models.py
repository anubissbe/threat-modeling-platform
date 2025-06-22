#!/usr/bin/env python3
"""
Model Deployment Script for MLOps Infrastructure
Deploys trained threat detection models to the MLOps serving infrastructure
"""

import os
import sys
import json
import time
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

import joblib
import requests

# Add the current directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('model-deployer')

class ModelDeployer:
    """Deploys trained models to MLOps infrastructure"""
    
    def __init__(self, models_dir: str = "./models", experiments_dir: str = "./experiments"):
        self.models_dir = Path(models_dir)
        self.experiments_dir = Path(experiments_dir)
        self.mlops_base_url = "http://localhost:3007"  # MLOps API endpoint
        
    def load_experiment_metadata(self, experiment_id: str) -> Dict[str, Any]:
        """Load experiment metadata"""
        experiment_dir = self.experiments_dir / experiment_id
        metadata_file = experiment_dir / "metadata.json"
        
        if not metadata_file.exists():
            raise FileNotFoundError(f"Experiment metadata not found: {metadata_file}")
        
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        logger.info(f"Loaded experiment metadata: {experiment_id}")
        return metadata
    
    def validate_models(self, experiment_id: str) -> Dict[str, bool]:
        """Validate that all required model files exist"""
        logger.info(f"Validating models for experiment: {experiment_id}")
        
        experiment_dir = self.experiments_dir / experiment_id
        required_files = [
            "models.joblib",
            "preprocessors.joblib",
            "metadata.json",
            "deployment_config.json"
        ]
        
        validation_results = {}
        for file_name in required_files:
            file_path = experiment_dir / file_name
            validation_results[file_name] = file_path.exists()
            
            if validation_results[file_name]:
                logger.info(f"✅ Found: {file_name}")
            else:
                logger.error(f"❌ Missing: {file_name}")
        
        # Check individual model files
        for model_file in self.models_dir.glob("*_v2.0.0.joblib"):
            validation_results[model_file.name] = True
            logger.info(f"✅ Found model: {model_file.name}")
        
        all_valid = all(validation_results.values())
        logger.info(f"Model validation {'passed' if all_valid else 'failed'}")
        
        return validation_results
    
    def register_models_with_registry(self, experiment_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Register models with MLOps model registry"""
        logger.info("Registering models with MLOps model registry...")
        
        registry_payload = {
            "experiment_id": experiment_id,
            "models": [],
            "timestamp": datetime.now().isoformat()
        }
        
        # Get evaluation results from metadata
        evaluation_results = metadata.get('evaluation_results', {})
        
        # Register each model
        model_names = ['signature_detector', 'anomaly_detector', 'ensemble_rf', 'ensemble_lr', 'ensemble_svm']
        
        for model_name in model_names:
            model_file = self.models_dir / f"{model_name}_v2.0.0.joblib"
            
            if model_file.exists():
                model_info = {
                    "name": model_name,
                    "version": "2.0.0",
                    "type": "threat_detection",
                    "framework": "scikit-learn",
                    "file_path": str(model_file),
                    "stage": "staging",
                    "performance_metrics": evaluation_results.get(model_name, {}),
                    "created_at": datetime.now().isoformat(),
                    "description": f"Advanced threat detection model: {model_name}"
                }
                registry_payload["models"].append(model_info)
                logger.info(f"Prepared registry entry for: {model_name}")
        
        # Include preprocessors
        preprocessors_file = self.models_dir / "preprocessors_v2.0.0.joblib"
        if preprocessors_file.exists():
            registry_payload["preprocessors"] = {
                "version": "2.0.0",
                "file_path": str(preprocessors_file),
                "created_at": datetime.now().isoformat()
            }
        
        # Try to register with MLOps API (if available)
        try:
            response = requests.post(
                f"{self.mlops_base_url}/api/mlops/models",
                json=registry_payload,
                timeout=30
            )
            
            if response.status_code == 200:
                logger.info("✅ Models registered with MLOps registry via API")
                return response.json()
            else:
                logger.warning(f"MLOps API registration failed: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"MLOps API not available: {e}")
        
        # Fallback: Save registry information locally
        experiment_dir = self.experiments_dir / experiment_id
        registry_file = experiment_dir / "model_registry_deployment.json"
        
        with open(registry_file, 'w') as f:
            json.dump(registry_payload, f, indent=2, default=str)
        
        logger.info(f"Models registered locally: {registry_file}")
        return registry_payload
    
    def create_model_serving_config(self, experiment_id: str, registry_info: Dict[str, Any]) -> Dict[str, Any]:
        """Create configuration for model serving"""
        logger.info("Creating model serving configuration...")
        
        serving_config = {
            "service_name": "threat-detection-models",
            "version": "2.0.0",
            "deployment_id": f"deploy-{experiment_id}-{int(time.time())}",
            "models": [],
            "ensemble_config": {
                "enabled": True,
                "voting_strategy": "weighted_average",
                "weights": {
                    "signature_detector": 0.3,
                    "anomaly_detector": 0.2,
                    "ensemble_rf": 0.5
                }
            },
            "serving_config": {
                "batch_size": 32,
                "timeout_ms": 5000,
                "max_concurrent_requests": 100,
                "health_check_interval": 30,
                "auto_scaling": {
                    "enabled": True,
                    "min_replicas": 1,
                    "max_replicas": 5,
                    "target_cpu_percent": 70,
                    "target_memory_percent": 80
                }
            },
            "monitoring": {
                "enabled": True,
                "metrics": [
                    "prediction_latency",
                    "prediction_accuracy",
                    "model_drift",
                    "data_drift",
                    "resource_usage"
                ],
                "alerting": {
                    "accuracy_threshold": 0.8,
                    "latency_threshold_ms": 1000,
                    "error_rate_threshold": 0.05,
                    "drift_threshold": 0.1
                }
            },
            "security": {
                "authentication_required": True,
                "rate_limiting": {
                    "requests_per_minute": 1000,
                    "burst_size": 100
                },
                "input_validation": True,
                "output_sanitization": True
            }
        }
        
        # Configure individual models
        for model_info in registry_info.get("models", []):
            model_config = {
                "name": model_info["name"],
                "version": model_info["version"],
                "file_path": model_info["file_path"],
                "endpoint": f"/predict/{model_info['name']}",
                "health_endpoint": f"/health/{model_info['name']}",
                "performance_metrics": model_info.get("performance_metrics", {}),
                "resource_requirements": {
                    "cpu": "500m",
                    "memory": "1Gi",
                    "gpu": 0  # Set to 1 when GPU is available
                }
            }
            serving_config["models"].append(model_config)
        
        return serving_config
    
    def deploy_to_serving_infrastructure(self, serving_config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy models to the serving infrastructure"""
        logger.info("Deploying models to serving infrastructure...")
        
        deployment_result = {
            "deployment_id": serving_config["deployment_id"],
            "status": "pending",
            "timestamp": datetime.now().isoformat(),
            "endpoints": [],
            "health_checks": []
        }
        
        # Try to deploy via MLOps API
        try:
            response = requests.post(
                f"{self.mlops_base_url}/api/mlops/deploy",
                json={
                    "deployment_config": serving_config,
                    "models": serving_config["models"]
                },
                timeout=60
            )
            
            if response.status_code == 200:
                deployment_result["status"] = "deployed"
                deployment_result["api_response"] = response.json()
                logger.info("✅ Models deployed via MLOps API")
                
                # Extract endpoint information
                for model in serving_config["models"]:
                    endpoint_info = {
                        "model": model["name"],
                        "endpoint": f"{self.mlops_base_url}{model['endpoint']}",
                        "health_endpoint": f"{self.mlops_base_url}{model['health_endpoint']}"
                    }
                    deployment_result["endpoints"].append(endpoint_info)
                
                return deployment_result
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"MLOps API deployment failed: {e}")
        
        # Fallback: Create deployment configuration for manual deployment
        logger.info("Creating deployment configuration for manual deployment...")
        
        deployment_result["status"] = "configuration_ready"
        deployment_result["manual_deployment"] = {
            "instructions": [
                "1. Copy model files to serving infrastructure",
                "2. Load models using the provided configuration",
                "3. Start serving endpoints",
                "4. Configure monitoring and alerting",
                "5. Run health checks"
            ],
            "model_files": [model["file_path"] for model in serving_config["models"]],
            "config_file": serving_config
        }
        
        # Generate endpoint URLs for reference
        for model in serving_config["models"]:
            endpoint_info = {
                "model": model["name"],
                "endpoint": f"{self.mlops_base_url}{model['endpoint']}",
                "health_endpoint": f"{self.mlops_base_url}{model['health_endpoint']}"
            }
            deployment_result["endpoints"].append(endpoint_info)
        
        return deployment_result
    
    def run_deployment_tests(self, deployment_result: Dict[str, Any]) -> Dict[str, Any]:
        """Run tests to validate deployment"""
        logger.info("Running deployment validation tests...")
        
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "tests": []
        }
        
        # Test model loading
        try:
            models_file = self.experiments_dir / "initial-training-20250614" / "models.joblib"
            if models_file.exists():
                models = joblib.load(models_file)
                test_results["tests"].append({
                    "test": "model_loading",
                    "status": "passed",
                    "details": f"Successfully loaded {len(models)} models"
                })
                logger.info("✅ Model loading test passed")
            else:
                test_results["tests"].append({
                    "test": "model_loading",
                    "status": "failed",
                    "details": "Model file not found"
                })
                logger.error("❌ Model loading test failed")
        except Exception as e:
            test_results["tests"].append({
                "test": "model_loading",
                "status": "failed",
                "details": f"Error loading models: {e}"
            })
            logger.error(f"❌ Model loading test failed: {e}")
        
        # Test preprocessor loading
        try:
            preprocessors_file = self.models_dir / "preprocessors_v2.0.0.joblib"
            if preprocessors_file.exists():
                preprocessors = joblib.load(preprocessors_file)
                test_results["tests"].append({
                    "test": "preprocessor_loading",
                    "status": "passed",
                    "details": f"Successfully loaded preprocessors"
                })
                logger.info("✅ Preprocessor loading test passed")
            else:
                test_results["tests"].append({
                    "test": "preprocessor_loading",
                    "status": "failed",
                    "details": "Preprocessor file not found"
                })
                logger.error("❌ Preprocessor loading test failed")
        except Exception as e:
            test_results["tests"].append({
                "test": "preprocessor_loading",
                "status": "failed",
                "details": f"Error loading preprocessors: {e}"
            })
            logger.error(f"❌ Preprocessor loading test failed: {e}")
        
        # Test endpoint connectivity (if deployed via API)
        if deployment_result.get("status") == "deployed":
            for endpoint_info in deployment_result.get("endpoints", []):
                try:
                    health_url = endpoint_info["health_endpoint"]
                    response = requests.get(health_url, timeout=10)
                    
                    if response.status_code == 200:
                        test_results["tests"].append({
                            "test": f"endpoint_health_{endpoint_info['model']}",
                            "status": "passed",
                            "details": f"Endpoint responding: {health_url}"
                        })
                        logger.info(f"✅ Health check passed: {endpoint_info['model']}")
                    else:
                        test_results["tests"].append({
                            "test": f"endpoint_health_{endpoint_info['model']}",
                            "status": "failed",
                            "details": f"Endpoint not responding: {health_url}"
                        })
                        logger.warning(f"⚠️ Health check failed: {endpoint_info['model']}")
                        
                except requests.exceptions.RequestException as e:
                    test_results["tests"].append({
                        "test": f"endpoint_health_{endpoint_info['model']}",
                        "status": "failed",
                        "details": f"Connection error: {e}"
                    })
                    logger.warning(f"⚠️ Cannot reach endpoint: {endpoint_info['model']}")
        
        # Calculate overall test status
        passed_tests = len([t for t in test_results["tests"] if t["status"] == "passed"])
        total_tests = len(test_results["tests"])
        test_results["summary"] = {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": total_tests - passed_tests,
            "success_rate": passed_tests / total_tests if total_tests > 0 else 0
        }
        
        logger.info(f"Deployment tests completed: {passed_tests}/{total_tests} passed")
        return test_results
    
    def save_deployment_summary(self, experiment_id: str, deployment_result: Dict[str, Any], test_results: Dict[str, Any]):
        """Save deployment summary"""
        experiment_dir = self.experiments_dir / experiment_id
        
        deployment_summary = {
            "experiment_id": experiment_id,
            "deployment_timestamp": datetime.now().isoformat(),
            "deployment_result": deployment_result,
            "test_results": test_results,
            "status": "deployed" if deployment_result.get("status") == "deployed" else "ready_for_deployment",
            "next_steps": []
        }
        
        # Add next steps based on deployment status
        if deployment_result.get("status") == "deployed":
            deployment_summary["next_steps"] = [
                "Monitor model performance via MLOps dashboard",
                "Set up automated retraining pipelines",
                "Configure A/B testing for model improvements",
                "Review and update monitoring thresholds"
            ]
        else:
            deployment_summary["next_steps"] = [
                "Set up MLOps serving infrastructure",
                "Deploy models using provided configuration",
                "Configure monitoring and alerting",
                "Run deployment validation tests"
            ]
        
        summary_file = experiment_dir / "deployment_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(deployment_summary, f, indent=2, default=str)
        
        logger.info(f"Deployment summary saved: {summary_file}")
        return deployment_summary

def main():
    parser = argparse.ArgumentParser(description='Deploy trained threat detection models')
    parser.add_argument('--experiment-id', type=str, required=True, help='Experiment ID to deploy')
    parser.add_argument('--models-dir', type=str, default='./models', help='Models directory')
    parser.add_argument('--experiments-dir', type=str, default='./experiments', help='Experiments directory')
    parser.add_argument('--mlops-url', type=str, default='http://localhost:3007', help='MLOps API base URL')
    parser.add_argument('--skip-tests', action='store_true', help='Skip deployment validation tests')
    
    args = parser.parse_args()
    
    logger.info(f"Starting model deployment for experiment: {args.experiment_id}")
    
    try:
        # Initialize deployer
        deployer = ModelDeployer(
            models_dir=args.models_dir,
            experiments_dir=args.experiments_dir
        )
        deployer.mlops_base_url = args.mlops_url
        
        # Load experiment metadata
        metadata = deployer.load_experiment_metadata(args.experiment_id)
        
        # Validate models
        validation_results = deployer.validate_models(args.experiment_id)
        if not all(validation_results.values()):
            logger.error("Model validation failed. Cannot proceed with deployment.")
            return 1
        
        # Register models with registry
        registry_info = deployer.register_models_with_registry(args.experiment_id, metadata)
        
        # Create serving configuration
        serving_config = deployer.create_model_serving_config(args.experiment_id, registry_info)
        
        # Deploy to serving infrastructure
        deployment_result = deployer.deploy_to_serving_infrastructure(serving_config)
        
        # Run deployment tests (unless skipped)
        if not args.skip_tests:
            test_results = deployer.run_deployment_tests(deployment_result)
        else:
            test_results = {"skipped": True, "timestamp": datetime.now().isoformat()}
        
        # Save deployment summary
        deployment_summary = deployer.save_deployment_summary(
            args.experiment_id,
            deployment_result,
            test_results
        )
        
        # Print summary
        print("\n" + "="*80)
        print(f"🚀 MODEL DEPLOYMENT COMPLETED")
        print("="*80)
        print(f"Experiment ID: {args.experiment_id}")
        print(f"Deployment ID: {deployment_result.get('deployment_id', 'N/A')}")
        print(f"Status: {deployment_result.get('status', 'unknown')}")
        print(f"Models Deployed: {len(serving_config.get('models', []))}")
        
        if deployment_result.get("endpoints"):
            print(f"\n📡 AVAILABLE ENDPOINTS:")
            for endpoint in deployment_result["endpoints"]:
                print(f"  {endpoint['model']}: {endpoint['endpoint']}")
        
        if not args.skip_tests and test_results.get("summary"):
            print(f"\n🧪 DEPLOYMENT TESTS:")
            summary = test_results["summary"]
            print(f"  Passed: {summary['passed']}/{summary['total_tests']}")
            print(f"  Success Rate: {summary['success_rate']:.1%}")
        
        print(f"\n📋 NEXT STEPS:")
        for i, step in enumerate(deployment_summary.get("next_steps", []), 1):
            print(f"  {i}. {step}")
        
        print(f"\nDeployment summary: {args.experiments_dir}/{args.experiment_id}/deployment_summary.json")
        print("="*80)
        
        return 0
        
    except Exception as e:
        logger.error(f"Deployment failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())