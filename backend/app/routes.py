from flask import Blueprint, request, jsonify
import numpy as np
from diffprivlib import mechanisms
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

main = Blueprint('main', __name__)

@main.route('/api/compute-stats', methods=['POST'])
def compute_stats():
    data = request.get_json()
    values = np.array(data['values'])
    epsilon = float(data['epsilon'])
    
    # Initialize DP mechanisms
    laplace_mech = mechanisms.Laplace(epsilon=epsilon, sensitivity=1.0)
    
    # Compute basic statistics with DP
    dp_mean = laplace_mech.randomise(np.mean(values))
    dp_count = laplace_mech.randomise(len(values))
    
    return jsonify({
        'dp_mean': float(dp_mean),
        'dp_count': int(dp_count),
        'original_mean': float(np.mean(values)),
        'original_count': len(values)
    })

@main.route('/api/train-model', methods=['POST'])
def train_model():
    data = request.get_json()
    X = np.array(data['features'])
    y = np.array(data['labels'])
    epsilon = float(data['epsilon'])
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    
    # Train original model
    original_model = LogisticRegression()
    original_model.fit(X_train, y_train)
    original_score = original_model.score(X_test, y_test)
    
    # Add DP noise to training data
    laplace_mech = mechanisms.Laplace(epsilon=epsilon, sensitivity=1.0)
    X_train_dp = np.array([[laplace_mech.randomise(x_i) for x_i in x] for x in X_train])
    
    # Train DP model
    dp_model = LogisticRegression()
    dp_model.fit(X_train_dp, y_train)
    dp_score = dp_model.score(X_test, y_test)
    
    return jsonify({
        'original_accuracy': float(original_score),
        'dp_accuracy': float(dp_score)
    })
