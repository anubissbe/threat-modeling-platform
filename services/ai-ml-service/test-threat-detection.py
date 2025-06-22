#!/usr/bin/env python3
"""
Threat Detection Accuracy Testing Script
Comprehensive testing of deployed threat detection models
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
import joblib
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, precision_recall_curve
import matplotlib.pyplot as plt
import seaborn as sns

# Add the current directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('threat-detection-tester')

class ThreatDetectionTester:
    """Comprehensive threat detection testing framework"""
    
    def __init__(self, models_dir: str = "./models", experiments_dir: str = "./experiments"):
        self.models_dir = Path(models_dir)
        self.experiments_dir = Path(experiments_dir)
        self.test_results_dir = Path("./test_results")
        self.test_results_dir.mkdir(exist_ok=True)
        
        self.models = {}
        self.preprocessors = {}
        
    def load_deployed_models(self, experiment_id: str) -> Dict[str, Any]:
        """Load deployed models and preprocessors"""
        logger.info(f"Loading deployed models for experiment: {experiment_id}")
        
        # Load models
        models_file = self.experiments_dir / experiment_id / "models.joblib"
        if models_file.exists():
            self.models = joblib.load(models_file)
            logger.info(f"Loaded {len(self.models)} models")
        else:
            logger.error(f"Models file not found: {models_file}")
            raise FileNotFoundError(f"Models file not found: {models_file}")
        
        # Load preprocessors
        preprocessors_file = self.experiments_dir / experiment_id / "preprocessors.joblib"
        if preprocessors_file.exists():
            self.preprocessors = joblib.load(preprocessors_file)
            logger.info("Loaded preprocessors")
        else:
            logger.error(f"Preprocessors file not found: {preprocessors_file}")
            raise FileNotFoundError(f"Preprocessors file not found: {preprocessors_file}")
        
        return {
            "models_loaded": len(self.models),
            "preprocessors_loaded": len(self.preprocessors),
            "model_names": list(self.models.keys())
        }
    
    def generate_test_data(self, n_samples: int = 1000, threat_ratio: float = 0.2) -> Tuple[pd.DataFrame, np.ndarray]:
        """Generate test data for validation"""
        logger.info(f"Generating test dataset with {n_samples} samples...")
        
        # Simple test data generation
        np.random.seed(123)  # Different seed for test data
        
        # Generate network features
        network_features = pd.DataFrame({
            'bytes_transferred': np.random.lognormal(10, 2, n_samples),
            'connection_count': np.random.poisson(5, n_samples),
            'unique_destinations': np.random.poisson(3, n_samples),
            'connection_duration': np.random.exponential(30, n_samples),
            'port_diversity': np.random.gamma(2, 2, n_samples),
            'protocol_anomaly_score': np.random.beta(2, 5, n_samples),
            'time_of_day': np.random.uniform(0, 24, n_samples),
            'is_weekend': np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
        })
        
        # Generate process features
        process_features = pd.DataFrame({
            'process_count': np.random.poisson(10, n_samples),
            'cpu_usage': np.random.beta(2, 8, n_samples),
            'memory_usage': np.random.beta(3, 7, n_samples),
            'file_access_count': np.random.poisson(20, n_samples),
            'registry_modifications': np.random.poisson(2, n_samples),
            'network_connections': np.random.poisson(5, n_samples),
            'privilege_level': np.random.choice([0, 1, 2], n_samples, p=[0.7, 0.2, 0.1]),
            'process_lifetime': np.random.exponential(60, n_samples)
        })
        
        # Generate user features
        user_features = pd.DataFrame({
            'login_frequency': np.random.gamma(2, 3, n_samples),
            'failed_logins': np.random.poisson(1, n_samples),
            'off_hours_activity': np.random.beta(1, 9, n_samples),
            'data_access_volume': np.random.lognormal(8, 1.5, n_samples),
            'privilege_escalations': np.random.poisson(0.5, n_samples),
            'geographic_anomaly': np.random.beta(1, 19, n_samples),
            'device_count': np.random.poisson(2, n_samples),
            'session_duration': np.random.gamma(3, 20, n_samples)
        })
        
        # Combine features
        features = pd.concat([network_features, process_features, user_features], axis=1)
        
        # Generate labels
        labels = np.random.choice([0, 1], n_samples, p=[1-threat_ratio, threat_ratio])
        
        # Introduce anomalies for threat samples
        threat_indices = np.where(labels == 1)[0]
        for idx in threat_indices:
            if np.random.random() < 0.8:  # 80% chance of anomaly
                feature_to_modify = np.random.choice(features.columns)
                current_value = features.loc[idx, feature_to_modify]
                
                if np.random.random() < 0.5:
                    features.loc[idx, feature_to_modify] = current_value * np.random.uniform(3, 10)
                else:
                    features.loc[idx, feature_to_modify] = current_value * np.random.uniform(0.1, 0.3)
        
        logger.info(f"Generated test data: {len(features)} samples, {sum(labels)} threats")
        return features, labels
    
    def preprocess_test_data(self, features: pd.DataFrame, labels: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Preprocess test data using trained preprocessors"""
        logger.info("Preprocessing test data...")
        
        # Handle missing values
        features_clean = features.fillna(features.median())
        
        # Scale features
        scaler = self.preprocessors['scalers']['feature_scaler']
        features_scaled = scaler.transform(features_clean)
        
        # Encode labels
        label_encoder = self.preprocessors['encoders']['label_encoder']
        labels_encoded = label_encoder.transform(labels)
        
        logger.info(f"Preprocessed data shape: {features_scaled.shape}")
        return features_scaled, labels_encoded
    
    def test_individual_models(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        """Test individual model performance"""
        logger.info("Testing individual model performance...")
        
        individual_results = {}
        
        for model_name, model in self.models.items():
            logger.info(f"Testing model: {model_name}")
            
            start_time = time.time()
            
            try:
                # Make predictions
                if hasattr(model, 'predict_proba'):
                    y_prob = model.predict_proba(X_test)
                    if y_prob.shape[1] > 1:
                        y_prob = y_prob[:, 1]  # Probability of positive class
                    else:
                        y_prob = y_prob.flatten()
                else:
                    y_prob = None
                
                if model_name == 'anomaly_detector':
                    # Anomaly detector returns -1 for anomalies, 1 for normal
                    y_pred_raw = model.predict(X_test)
                    y_pred = (y_pred_raw == -1).astype(int)  # Convert to binary
                else:
                    y_pred = model.predict(X_test)
                
                prediction_time = time.time() - start_time
                
                # Calculate metrics
                accuracy = (y_pred == y_test).mean()
                
                # Classification report
                report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
                
                # Confusion matrix
                cm = confusion_matrix(y_test, y_pred)
                
                # ROC AUC (if probabilities available)
                roc_auc = None
                if y_prob is not None:
                    try:
                        roc_auc = roc_auc_score(y_test, y_prob)
                    except ValueError:
                        logger.warning(f"Could not calculate ROC AUC for {model_name}")
                
                individual_results[model_name] = {
                    "accuracy": accuracy,
                    "classification_report": report,
                    "confusion_matrix": cm.tolist(),
                    "roc_auc": roc_auc,
                    "prediction_time": prediction_time,
                    "predictions_per_second": len(X_test) / prediction_time,
                    "status": "success"
                }
                
                logger.info(f"✅ {model_name}: Accuracy={accuracy:.3f}, Time={prediction_time:.3f}s")
                
            except Exception as e:
                logger.error(f"❌ Error testing {model_name}: {e}")
                individual_results[model_name] = {
                    "status": "error",
                    "error": str(e),
                    "prediction_time": time.time() - start_time
                }
        
        return individual_results
    
    def test_ensemble_performance(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        """Test ensemble model performance"""
        logger.info("Testing ensemble model performance...")
        
        # Define ensemble strategies
        ensemble_strategies = {
            "majority_vote": self.majority_vote_ensemble,
            "weighted_average": self.weighted_average_ensemble,
            "best_model": self.best_model_ensemble
        }
        
        ensemble_results = {}
        
        for strategy_name, strategy_func in ensemble_strategies.items():
            logger.info(f"Testing ensemble strategy: {strategy_name}")
            
            try:
                start_time = time.time()
                y_pred, y_prob = strategy_func(X_test)
                prediction_time = time.time() - start_time
                
                # Calculate metrics
                accuracy = (y_pred == y_test).mean()
                report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
                cm = confusion_matrix(y_test, y_pred)
                
                roc_auc = None
                if y_prob is not None:
                    try:
                        roc_auc = roc_auc_score(y_test, y_prob)
                    except ValueError:
                        pass
                
                ensemble_results[strategy_name] = {
                    "accuracy": accuracy,
                    "classification_report": report,
                    "confusion_matrix": cm.tolist(),
                    "roc_auc": roc_auc,
                    "prediction_time": prediction_time,
                    "predictions_per_second": len(X_test) / prediction_time,
                    "status": "success"
                }
                
                logger.info(f"✅ {strategy_name}: Accuracy={accuracy:.3f}")
                
            except Exception as e:
                logger.error(f"❌ Error testing {strategy_name}: {e}")
                ensemble_results[strategy_name] = {
                    "status": "error",
                    "error": str(e)
                }
        
        return ensemble_results
    
    def majority_vote_ensemble(self, X_test: np.ndarray) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """Majority vote ensemble strategy"""
        predictions = []
        
        for model_name, model in self.models.items():
            if model_name == 'anomaly_detector':
                y_pred_raw = model.predict(X_test)
                y_pred = (y_pred_raw == -1).astype(int)
            else:
                y_pred = model.predict(X_test)
            predictions.append(y_pred)
        
        # Majority vote
        predictions_array = np.array(predictions)
        ensemble_pred = np.round(predictions_array.mean(axis=0)).astype(int)
        
        return ensemble_pred, None
    
    def weighted_average_ensemble(self, X_test: np.ndarray) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """Weighted average ensemble strategy"""
        weights = {
            'signature_detector': 0.3,
            'anomaly_detector': 0.2,
            'ensemble_rf': 0.5,
            'ensemble_lr': 0.0,  # Lower weight
            'ensemble_svm': 0.0   # Lower weight
        }
        
        weighted_probs = []
        total_weight = 0
        
        for model_name, model in self.models.items():
            weight = weights.get(model_name, 0.1)
            if weight == 0:
                continue
                
            if hasattr(model, 'predict_proba') and model_name != 'anomaly_detector':
                y_prob = model.predict_proba(X_test)
                if y_prob.shape[1] > 1:
                    y_prob = y_prob[:, 1]
                else:
                    y_prob = y_prob.flatten()
            elif model_name == 'anomaly_detector':
                # Convert anomaly scores to probabilities
                y_pred_raw = model.predict(X_test)
                y_prob = (y_pred_raw == -1).astype(float)
            else:
                y_pred = model.predict(X_test)
                y_prob = y_pred.astype(float)
            
            weighted_probs.append(y_prob * weight)
            total_weight += weight
        
        if weighted_probs:
            ensemble_prob = np.sum(weighted_probs, axis=0) / total_weight
            ensemble_pred = (ensemble_prob > 0.5).astype(int)
            return ensemble_pred, ensemble_prob
        else:
            return np.zeros(len(X_test), dtype=int), None
    
    def best_model_ensemble(self, X_test: np.ndarray) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """Use best performing model only"""
        # Use Random Forest as the best model based on training results
        model = self.models.get('ensemble_rf') or self.models.get('signature_detector')
        
        if model:
            y_pred = model.predict(X_test)
            y_prob = None
            if hasattr(model, 'predict_proba'):
                y_prob = model.predict_proba(X_test)[:, 1]
            return y_pred, y_prob
        else:
            return np.zeros(len(X_test), dtype=int), None
    
    def test_performance_under_load(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        """Test performance under different load conditions"""
        logger.info("Testing performance under load...")
        
        load_test_results = {}
        
        # Test different batch sizes
        batch_sizes = [1, 10, 50, 100, 500, 1000]
        
        for batch_size in batch_sizes:
            if batch_size > len(X_test):
                continue
                
            logger.info(f"Testing batch size: {batch_size}")
            
            # Sample data for this batch size
            indices = np.random.choice(len(X_test), size=batch_size, replace=False)
            X_batch = X_test[indices]
            y_batch = y_test[indices]
            
            batch_results = {}
            
            # Test each model
            for model_name, model in self.models.items():
                try:
                    start_time = time.time()
                    
                    if model_name == 'anomaly_detector':
                        y_pred_raw = model.predict(X_batch)
                        y_pred = (y_pred_raw == -1).astype(int)
                    else:
                        y_pred = model.predict(X_batch)
                    
                    prediction_time = time.time() - start_time
                    accuracy = (y_pred == y_batch).mean()
                    
                    batch_results[model_name] = {
                        "accuracy": accuracy,
                        "prediction_time": prediction_time,
                        "throughput": batch_size / prediction_time,
                        "latency_per_sample": prediction_time / batch_size * 1000  # ms
                    }
                    
                except Exception as e:
                    batch_results[model_name] = {
                        "error": str(e)
                    }
            
            load_test_results[f"batch_size_{batch_size}"] = batch_results
        
        return load_test_results
    
    def generate_performance_report(self, individual_results: Dict[str, Any], 
                                  ensemble_results: Dict[str, Any],
                                  load_test_results: Dict[str, Any],
                                  experiment_id: str) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        logger.info("Generating performance report...")
        
        # Find best performing models
        best_individual = max(
            [(name, results.get("accuracy", 0)) for name, results in individual_results.items() 
             if results.get("status") == "success"],
            key=lambda x: x[1],
            default=("none", 0)
        )
        
        best_ensemble = max(
            [(name, results.get("accuracy", 0)) for name, results in ensemble_results.items()
             if results.get("status") == "success"],
            key=lambda x: x[1],
            default=("none", 0)
        )
        
        # Calculate average performance metrics
        successful_individual = {k: v for k, v in individual_results.items() if v.get("status") == "success"}
        avg_accuracy = np.mean([r["accuracy"] for r in successful_individual.values()]) if successful_individual else 0
        avg_prediction_time = np.mean([r["prediction_time"] for r in successful_individual.values()]) if successful_individual else 0
        
        # Performance summary
        performance_summary = {
            "test_timestamp": datetime.now().isoformat(),
            "experiment_id": experiment_id,
            "overall_performance": {
                "best_individual_model": {
                    "name": best_individual[0],
                    "accuracy": best_individual[1]
                },
                "best_ensemble_strategy": {
                    "name": best_ensemble[0],
                    "accuracy": best_ensemble[1]
                },
                "average_individual_accuracy": avg_accuracy,
                "average_prediction_time": avg_prediction_time,
                "models_tested": len(individual_results),
                "successful_tests": len(successful_individual)
            },
            "individual_model_results": individual_results,
            "ensemble_results": ensemble_results,
            "load_test_results": load_test_results,
            "recommendations": self.generate_recommendations(individual_results, ensemble_results)
        }
        
        return performance_summary
    
    def generate_recommendations(self, individual_results: Dict[str, Any], 
                               ensemble_results: Dict[str, Any]) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []
        
        # Accuracy recommendations
        successful_models = {k: v for k, v in individual_results.items() if v.get("status") == "success"}
        
        if successful_models:
            avg_accuracy = np.mean([r["accuracy"] for r in successful_models.values()])
            
            if avg_accuracy < 0.85:
                recommendations.append("Consider retraining models with more diverse data")
                recommendations.append("Implement feature engineering to improve model performance")
            
            # Performance recommendations
            avg_prediction_time = np.mean([r["prediction_time"] for r in successful_models.values()])
            
            if avg_prediction_time > 1.0:
                recommendations.append("Optimize model inference for better latency")
                recommendations.append("Consider model quantization or pruning")
            
            # Ensemble recommendations
            ensemble_accuracies = [r.get("accuracy", 0) for r in ensemble_results.values() if r.get("status") == "success"]
            individual_accuracies = [r["accuracy"] for r in successful_models.values()]
            
            if ensemble_accuracies and max(ensemble_accuracies) > max(individual_accuracies):
                recommendations.append("Deploy ensemble model for best performance")
            else:
                recommendations.append("Individual models perform well, consider single model deployment")
        
        # Model-specific recommendations
        for model_name, results in individual_results.items():
            if results.get("status") == "error":
                recommendations.append(f"Fix deployment issues for {model_name}")
            elif results.get("accuracy", 0) < 0.8:
                recommendations.append(f"Retrain or replace {model_name} for better accuracy")
        
        return recommendations
    
    def save_test_results(self, performance_report: Dict[str, Any], experiment_id: str):
        """Save test results to files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save JSON report
        report_file = self.test_results_dir / f"test_report_{experiment_id}_{timestamp}.json"
        with open(report_file, 'w') as f:
            json.dump(performance_report, f, indent=2, default=str)
        
        logger.info(f"Test results saved: {report_file}")
        return report_file

def main():
    parser = argparse.ArgumentParser(description='Test threat detection model accuracy')
    parser.add_argument('--experiment-id', type=str, required=True, help='Experiment ID to test')
    parser.add_argument('--test-samples', type=int, default=1000, help='Number of test samples')
    parser.add_argument('--threat-ratio', type=float, default=0.2, help='Ratio of threat samples in test data')
    parser.add_argument('--models-dir', type=str, default='./models', help='Models directory')
    parser.add_argument('--experiments-dir', type=str, default='./experiments', help='Experiments directory')
    parser.add_argument('--skip-load-test', action='store_true', help='Skip load testing')
    
    args = parser.parse_args()
    
    logger.info(f"Starting threat detection accuracy testing for experiment: {args.experiment_id}")
    
    try:
        # Initialize tester
        tester = ThreatDetectionTester(
            models_dir=args.models_dir,
            experiments_dir=args.experiments_dir
        )
        
        # Load deployed models
        load_info = tester.load_deployed_models(args.experiment_id)
        
        # Generate test data
        features, labels = tester.generate_test_data(
            n_samples=args.test_samples,
            threat_ratio=args.threat_ratio
        )
        
        # Preprocess test data
        X_test, y_test = tester.preprocess_test_data(features, labels)
        
        # Test individual models
        individual_results = tester.test_individual_models(X_test, y_test)
        
        # Test ensemble performance
        ensemble_results = tester.test_ensemble_performance(X_test, y_test)
        
        # Test performance under load (unless skipped)
        if not args.skip_load_test:
            load_test_results = tester.test_performance_under_load(X_test, y_test)
        else:
            load_test_results = {"skipped": True}
        
        # Generate performance report
        performance_report = tester.generate_performance_report(
            individual_results,
            ensemble_results,
            load_test_results,
            args.experiment_id
        )
        
        # Save results
        report_file = tester.save_test_results(performance_report, args.experiment_id)
        
        # Print summary
        print("\n" + "="*80)
        print(f"🧪 THREAT DETECTION ACCURACY TESTING COMPLETED")
        print("="*80)
        print(f"Experiment ID: {args.experiment_id}")
        print(f"Test Samples: {args.test_samples:,}")
        print(f"Models Tested: {load_info['models_loaded']}")
        
        overall = performance_report["overall_performance"]
        print(f"\n📊 PERFORMANCE SUMMARY:")
        print(f"Best Individual Model: {overall['best_individual_model']['name']} ({overall['best_individual_model']['accuracy']:.3f})")
        print(f"Best Ensemble Strategy: {overall['best_ensemble_strategy']['name']} ({overall['best_ensemble_strategy']['accuracy']:.3f})")
        print(f"Average Accuracy: {overall['average_individual_accuracy']:.3f}")
        print(f"Average Prediction Time: {overall['average_prediction_time']:.3f}s")
        
        print(f"\n📈 INDIVIDUAL MODEL RESULTS:")
        for model_name, results in individual_results.items():
            if results.get("status") == "success":
                accuracy = results["accuracy"]
                pred_time = results["prediction_time"]
                throughput = results["predictions_per_second"]
                print(f"  {model_name}: {accuracy:.3f} accuracy, {pred_time:.3f}s, {throughput:.0f} pred/s")
            else:
                print(f"  {model_name}: ❌ {results.get('error', 'Unknown error')}")
        
        print(f"\n🔧 RECOMMENDATIONS:")
        for i, rec in enumerate(performance_report["recommendations"], 1):
            print(f"  {i}. {rec}")
        
        print(f"\nDetailed results: {report_file}")
        print("="*80)
        
        return 0
        
    except Exception as e:
        logger.error(f"Testing failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())