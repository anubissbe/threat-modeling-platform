#!/usr/bin/env python3
"""
Threat Detection Model Training Script
Trains advanced threat detection models with MLOps integration
"""

import os
import sys
import json
import time
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
import joblib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('threat-model-trainer')

class ThreatDataGenerator:
    """Generate synthetic threat data for training"""
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        self.threat_categories = [
            'sql_injection', 'xss', 'privilege_escalation', 'data_exfiltration',
            'malware', 'phishing', 'dos', 'insider_threat', 'apt', 'ransomware'
        ]
        
    def generate_network_features(self, n_samples: int) -> pd.DataFrame:
        """Generate network-based features"""
        return pd.DataFrame({
            'bytes_transferred': np.random.lognormal(10, 2, n_samples),
            'connection_count': np.random.poisson(5, n_samples),
            'unique_destinations': np.random.poisson(3, n_samples),
            'connection_duration': np.random.exponential(30, n_samples),
            'port_diversity': np.random.gamma(2, 2, n_samples),
            'protocol_anomaly_score': np.random.beta(2, 5, n_samples),
            'time_of_day': np.random.uniform(0, 24, n_samples),
            'is_weekend': np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
        })
    
    def generate_process_features(self, n_samples: int) -> pd.DataFrame:
        """Generate process-based features"""
        return pd.DataFrame({
            'process_count': np.random.poisson(10, n_samples),
            'cpu_usage': np.random.beta(2, 8, n_samples),
            'memory_usage': np.random.beta(3, 7, n_samples),
            'file_access_count': np.random.poisson(20, n_samples),
            'registry_modifications': np.random.poisson(2, n_samples),
            'network_connections': np.random.poisson(5, n_samples),
            'privilege_level': np.random.choice([0, 1, 2], n_samples, p=[0.7, 0.2, 0.1]),
            'process_lifetime': np.random.exponential(60, n_samples)
        })
    
    def generate_user_features(self, n_samples: int) -> pd.DataFrame:
        """Generate user behavior features"""
        return pd.DataFrame({
            'login_frequency': np.random.gamma(2, 3, n_samples),
            'failed_logins': np.random.poisson(1, n_samples),
            'off_hours_activity': np.random.beta(1, 9, n_samples),
            'data_access_volume': np.random.lognormal(8, 1.5, n_samples),
            'privilege_escalations': np.random.poisson(0.5, n_samples),
            'geographic_anomaly': np.random.beta(1, 19, n_samples),
            'device_count': np.random.poisson(2, n_samples),
            'session_duration': np.random.gamma(3, 20, n_samples)
        })
    
    def generate_labels(self, n_samples: int, threat_ratio: float = 0.15) -> Tuple[np.ndarray, np.ndarray]:
        """Generate threat labels and categories"""
        is_threat = np.random.choice([0, 1], n_samples, p=[1-threat_ratio, threat_ratio])
        
        threat_categories = np.full(n_samples, 'benign', dtype=object)
        threat_indices = np.where(is_threat == 1)[0]
        
        for idx in threat_indices:
            threat_categories[idx] = np.random.choice(self.threat_categories)
            
        return is_threat, threat_categories
    
    def introduce_anomalies(self, features: pd.DataFrame, labels: np.ndarray) -> pd.DataFrame:
        """Introduce realistic anomalies for threat samples"""
        anomaly_features = features.copy()
        threat_indices = np.where(labels == 1)[0]
        
        for idx in threat_indices:
            # Introduce anomalies based on threat type
            if np.random.random() < 0.8:  # 80% chance of anomaly
                # Random feature anomalies
                feature_to_modify = np.random.choice(features.columns)
                current_value = anomaly_features.loc[idx, feature_to_modify]
                
                # Make value anomalous (either very high or very low)
                if np.random.random() < 0.5:
                    anomaly_features.loc[idx, feature_to_modify] = current_value * np.random.uniform(3, 10)
                else:
                    anomaly_features.loc[idx, feature_to_modify] = current_value * np.random.uniform(0.1, 0.3)
        
        return anomaly_features
    
    def generate_dataset(self, n_samples: int = 10000, threat_ratio: float = 0.15) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
        """Generate complete synthetic threat dataset"""
        logger.info(f"Generating synthetic dataset with {n_samples} samples...")
        
        # Generate feature sets
        network_features = self.generate_network_features(n_samples)
        process_features = self.generate_process_features(n_samples)
        user_features = self.generate_user_features(n_samples)
        
        # Combine all features
        features = pd.concat([network_features, process_features, user_features], axis=1)
        
        # Generate labels
        is_threat, threat_categories = self.generate_labels(n_samples, threat_ratio)
        
        # Introduce realistic anomalies
        features = self.introduce_anomalies(features, is_threat)
        
        logger.info(f"Dataset generated: {len(features)} samples, {sum(is_threat)} threats ({sum(is_threat)/len(features)*100:.1f}%)")
        return features, is_threat, threat_categories

class ThreatModelTrainer:
    """Advanced threat detection model trainer"""
    
    def __init__(self, models_dir: str = "./models", experiments_dir: str = "./experiments"):
        self.models_dir = Path(models_dir)
        self.experiments_dir = Path(experiments_dir)
        self.models_dir.mkdir(exist_ok=True)
        self.experiments_dir.mkdir(exist_ok=True)
        
        self.models = {}
        self.scalers = {}
        self.encoders = {}
        
    def prepare_data(self, features: pd.DataFrame, labels: np.ndarray) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
        """Prepare data for training"""
        logger.info("Preparing data for training...")
        
        # Handle missing values
        features_clean = features.fillna(features.median())
        
        # Scale features
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features_clean)
        
        # Encode labels
        label_encoder = LabelEncoder()
        labels_encoded = label_encoder.fit_transform(labels)
        
        # Store preprocessing objects
        self.scalers['feature_scaler'] = scaler
        self.encoders['label_encoder'] = label_encoder
        
        preprocessing_info = {
            'feature_names': list(features.columns),
            'n_features': features_scaled.shape[1],
            'n_classes': len(label_encoder.classes_),
            'class_names': list(label_encoder.classes_)
        }
        
        logger.info(f"Data prepared: {features_scaled.shape[0]} samples, {features_scaled.shape[1]} features, {len(label_encoder.classes_)} classes")
        return features_scaled, labels_encoded, preprocessing_info
    
    def train_signature_detector(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        """Train signature-based detection model"""
        logger.info("Training signature-based detector (Random Forest)...")
        
        model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        
        start_time = time.time()
        model.fit(X_train, y_train)
        training_time = time.time() - start_time
        
        self.models['signature_detector'] = model
        
        return {
            'model_type': 'RandomForest',
            'training_time': training_time,
            'n_estimators': model.n_estimators,
            'feature_importance': model.feature_importances_.tolist()
        }
    
    def train_anomaly_detector(self, X_train: np.ndarray) -> Dict[str, Any]:
        """Train anomaly detection model"""
        logger.info("Training anomaly detector (Isolation Forest)...")
        
        model = IsolationForest(
            contamination=0.15,
            n_estimators=200,
            random_state=42,
            n_jobs=-1
        )
        
        start_time = time.time()
        model.fit(X_train)
        training_time = time.time() - start_time
        
        self.models['anomaly_detector'] = model
        
        return {
            'model_type': 'IsolationForest',
            'training_time': training_time,
            'contamination': model.contamination
        }
    
    def train_ensemble_classifier(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        """Train ensemble classification model"""
        logger.info("Training ensemble classifier...")
        
        # Train multiple base models
        rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
        lr_model = LogisticRegression(random_state=42, max_iter=1000)
        svm_model = SVC(probability=True, random_state=42)
        
        start_time = time.time()
        rf_model.fit(X_train, y_train)
        lr_model.fit(X_train, y_train)
        svm_model.fit(X_train, y_train)
        training_time = time.time() - start_time
        
        self.models['ensemble_rf'] = rf_model
        self.models['ensemble_lr'] = lr_model
        self.models['ensemble_svm'] = svm_model
        
        return {
            'model_type': 'Ensemble',
            'training_time': training_time,
            'base_models': ['RandomForest', 'LogisticRegression', 'SVM']
        }
    
    def evaluate_models(self, X_test: np.ndarray, y_test: np.ndarray, preprocessing_info: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate all trained models"""
        logger.info("Evaluating trained models...")
        
        evaluation_results = {}
        
        # Evaluate signature detector
        if 'signature_detector' in self.models:
            model = self.models['signature_detector']
            y_pred = model.predict(X_test)
            y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else None
            
            evaluation_results['signature_detector'] = {
                'classification_report': classification_report(y_test, y_pred, output_dict=True),
                'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
                'roc_auc': roc_auc_score(y_test, y_prob) if y_prob is not None else None,
                'accuracy': (y_pred == y_test).mean()
            }
        
        # Evaluate anomaly detector
        if 'anomaly_detector' in self.models:
            model = self.models['anomaly_detector']
            y_pred_anomaly = model.predict(X_test)
            # Convert anomaly predictions (-1, 1) to binary (0, 1)
            y_pred_binary = (y_pred_anomaly == -1).astype(int)
            
            evaluation_results['anomaly_detector'] = {
                'classification_report': classification_report(y_test, y_pred_binary, output_dict=True),
                'confusion_matrix': confusion_matrix(y_test, y_pred_binary).tolist(),
                'accuracy': (y_pred_binary == y_test).mean()
            }
        
        # Evaluate ensemble (using Random Forest as primary)
        if 'ensemble_rf' in self.models:
            model = self.models['ensemble_rf']
            y_pred = model.predict(X_test)
            y_prob = model.predict_proba(X_test)[:, 1]
            
            evaluation_results['ensemble'] = {
                'classification_report': classification_report(y_test, y_pred, output_dict=True),
                'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
                'roc_auc': roc_auc_score(y_test, y_prob),
                'accuracy': (y_pred == y_test).mean()
            }
        
        return evaluation_results
    
    def save_models(self, experiment_id: str, preprocessing_info: Dict[str, Any], training_info: Dict[str, Any], evaluation_results: Dict[str, Any]):
        """Save trained models and metadata"""
        logger.info(f"Saving models for experiment {experiment_id}...")
        
        experiment_dir = self.experiments_dir / experiment_id
        experiment_dir.mkdir(exist_ok=True)
        
        # Save models
        models_file = experiment_dir / "models.joblib"
        joblib.dump(self.models, models_file)
        
        # Save preprocessors
        preprocessors_file = experiment_dir / "preprocessors.joblib"
        joblib.dump({
            'scalers': self.scalers,
            'encoders': self.encoders
        }, preprocessors_file)
        
        # Save metadata
        metadata = {
            'experiment_id': experiment_id,
            'timestamp': datetime.now().isoformat(),
            'preprocessing_info': preprocessing_info,
            'training_info': training_info,
            'evaluation_results': evaluation_results,
            'model_versions': {name: '2.0.0' for name in self.models.keys()}
        }
        
        metadata_file = experiment_dir / "metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        # Copy models to main models directory with versioning
        for model_name, model in self.models.items():
            model_file = self.models_dir / f"{model_name}_v2.0.0.joblib"
            joblib.dump(model, model_file)
        
        # Save preprocessors to main directory
        preprocessors_file = self.models_dir / "preprocessors_v2.0.0.joblib"
        joblib.dump({
            'scalers': self.scalers,
            'encoders': self.encoders
        }, preprocessors_file)
        
        logger.info(f"Models saved to {experiment_dir} and {self.models_dir}")
        return experiment_dir

class MLOpsIntegration:
    """Integration with MLOps infrastructure"""
    
    def __init__(self, model_registry_url: Optional[str] = None):
        self.model_registry_url = model_registry_url
        
    def register_models(self, experiment_dir: Path, metadata: Dict[str, Any]):
        """Register trained models with MLOps model registry"""
        logger.info("Registering models with MLOps registry...")
        
        # TODO: Integrate with actual MLOps model registry
        # For now, create a registry entry file
        registry_file = experiment_dir / "mlops_registry.json"
        
        registry_entry = {
            'models': {},
            'experiment_id': metadata.get('experiment_id'),
            'registration_time': datetime.now().isoformat(),
            'performance_metrics': metadata.get('evaluation_results', {}),
            'model_artifacts': []
        }
        
        # Register each model
        for model_name in metadata.get('training_info', {}).keys():
            if model_name.endswith('_info'):
                continue
                
            model_info = {
                'name': model_name,
                'version': '2.0.0',
                'framework': 'scikit-learn',
                'type': 'threat_detection',
                'stage': 'staging',
                'metrics': metadata.get('evaluation_results', {}).get(model_name, {}),
                'artifacts': {
                    'model_file': f"{model_name}_v2.0.0.joblib",
                    'metadata_file': "metadata.json",
                    'preprocessors_file': "preprocessors_v2.0.0.joblib"
                }
            }
            
            registry_entry['models'][model_name] = model_info
            registry_entry['model_artifacts'].append(f"{model_name}_v2.0.0.joblib")
        
        with open(registry_file, 'w') as f:
            json.dump(registry_entry, f, indent=2, default=str)
            
        logger.info(f"Models registered in MLOps registry: {registry_file}")
        return registry_entry
    
    def create_deployment_config(self, experiment_dir: Path, registry_entry: Dict[str, Any]):
        """Create deployment configuration for MLOps serving"""
        deployment_config = {
            'deployment_name': 'threat-detection-models',
            'version': '2.0.0',
            'models': [],
            'serving_config': {
                'replicas': 2,
                'resources': {
                    'cpu': '1000m',
                    'memory': '2Gi',
                    'gpu': 0  # Set to 1 when GPU is available
                },
                'auto_scaling': {
                    'min_replicas': 1,
                    'max_replicas': 5,
                    'target_cpu_utilization': 70
                }
            },
            'monitoring': {
                'enabled': True,
                'metrics': ['accuracy', 'latency', 'throughput'],
                'alerts': {
                    'accuracy_threshold': 0.8,
                    'latency_threshold': 1000,  # milliseconds
                    'error_rate_threshold': 0.05
                }
            }
        }
        
        # Add model configurations
        for model_name, model_info in registry_entry.get('models', {}).items():
            model_config = {
                'name': model_name,
                'version': model_info['version'],
                'artifact_path': model_info['artifacts']['model_file'],
                'preprocessing_path': model_info['artifacts']['preprocessors_file'],
                'prediction_endpoint': f"/predict/{model_name}",
                'health_endpoint': f"/health/{model_name}"
            }
            deployment_config['models'].append(model_config)
        
        deployment_file = experiment_dir / "deployment_config.json"
        with open(deployment_file, 'w') as f:
            json.dump(deployment_config, f, indent=2, default=str)
            
        logger.info(f"Deployment configuration created: {deployment_file}")
        return deployment_config

def main():
    parser = argparse.ArgumentParser(description='Train advanced threat detection models')
    parser.add_argument('--samples', type=int, default=10000, help='Number of training samples')
    parser.add_argument('--threat-ratio', type=float, default=0.15, help='Ratio of threat samples')
    parser.add_argument('--models-dir', type=str, default='./models', help='Models output directory')
    parser.add_argument('--experiments-dir', type=str, default='./experiments', help='Experiments directory')
    parser.add_argument('--experiment-id', type=str, default=None, help='Experiment ID (auto-generated if not provided)')
    parser.add_argument('--gpu', action='store_true', help='Use GPU acceleration (if available)')
    
    args = parser.parse_args()
    
    # Generate experiment ID if not provided
    if not args.experiment_id:
        args.experiment_id = f"threat-detection-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    
    logger.info(f"Starting threat detection model training - Experiment: {args.experiment_id}")
    
    try:
        # Generate synthetic training data
        data_generator = ThreatDataGenerator()
        features, labels, categories = data_generator.generate_dataset(
            n_samples=args.samples,
            threat_ratio=args.threat_ratio
        )
        
        # Initialize trainer
        trainer = ThreatModelTrainer(
            models_dir=args.models_dir,
            experiments_dir=args.experiments_dir
        )
        
        # Prepare data
        X, y, preprocessing_info = trainer.prepare_data(features, labels)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        logger.info(f"Training set: {X_train.shape[0]} samples")
        logger.info(f"Test set: {X_test.shape[0]} samples")
        
        # Train models
        training_info = {}
        
        # Train signature-based detector
        signature_info = trainer.train_signature_detector(X_train, y_train)
        training_info['signature_detector_info'] = signature_info
        
        # Train anomaly detector
        anomaly_info = trainer.train_anomaly_detector(X_train)
        training_info['anomaly_detector_info'] = anomaly_info
        
        # Train ensemble classifier
        ensemble_info = trainer.train_ensemble_classifier(X_train, y_train)
        training_info['ensemble_info'] = ensemble_info
        
        # Evaluate models
        evaluation_results = trainer.evaluate_models(X_test, y_test, preprocessing_info)
        
        # Save models and metadata
        experiment_dir = trainer.save_models(
            args.experiment_id,
            preprocessing_info,
            training_info,
            evaluation_results
        )
        
        # MLOps integration
        mlops = MLOpsIntegration()
        
        # Load complete metadata
        metadata_file = experiment_dir / "metadata.json"
        with open(metadata_file, 'r') as f:
            complete_metadata = json.load(f)
        
        # Register with MLOps
        registry_entry = mlops.register_models(experiment_dir, complete_metadata)
        deployment_config = mlops.create_deployment_config(experiment_dir, registry_entry)
        
        # Print results summary
        print("\n" + "="*80)
        print(f"🎯 THREAT DETECTION MODEL TRAINING COMPLETED")
        print("="*80)
        print(f"Experiment ID: {args.experiment_id}")
        print(f"Training Samples: {args.samples:,}")
        print(f"Models Trained: {len(trainer.models)}")
        print(f"Experiment Directory: {experiment_dir}")
        print(f"Models Directory: {trainer.models_dir}")
        
        print(f"\n📊 MODEL PERFORMANCE SUMMARY:")
        for model_name, results in evaluation_results.items():
            accuracy = results.get('accuracy', 0)
            print(f"  {model_name}: {accuracy:.3f} accuracy")
        
        print(f"\n🔧 NEXT STEPS:")
        print(f"1. Review experiment results: {experiment_dir}/metadata.json")
        print(f"2. Deploy models: Use {experiment_dir}/deployment_config.json")
        print(f"3. Monitor performance: Set up MLOps monitoring")
        print(f"4. Test models: Use the trained models in threat detection service")
        
        if args.gpu:
            print(f"5. GPU Training: Configure GPU environment for acceleration")
        
        print("="*80)
        
        return 0
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())