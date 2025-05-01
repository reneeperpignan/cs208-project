from flask import Blueprint, request, jsonify
import numpy as np
from diffprivlib import mechanisms
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import time

main = Blueprint('main', __name__)

@main.route('/api/compute-stats', methods=['POST'])
def compute_stats():
    data = request.get_json()
    df = pd.DataFrame(data['data'])
    epsilon = float(data['epsilon'])
    group_by = data['group_by']
    statistic = data['statistic']
    column = data['column']

    results = []
    original_ranking = []
    dp_ranking = []
    laplace_mech = mechanisms.Laplace(epsilon=epsilon, sensitivity=1.0)

    if not group_by:
        series = pd.to_numeric(df[column], errors='coerce').dropna()
        if statistic == 'mean':
            orig = series.mean()
            dp = laplace_mech.randomise(orig)
        elif statistic == 'count':
            orig = series.count()
            dp = laplace_mech.randomise(orig)
        elif statistic == 'percent':
            pos = ((series == 1) | (series == '1')).sum()
            orig = pos / len(series) if len(series) > 0 else 0
            dp = np.clip(laplace_mech.randomise(orig), 0, 1)
        else:
            return jsonify({'error': 'Unknown statistic'}), 400
        results.append({'name': column, 'original': float(orig), 'dp': float(dp)})
        return jsonify({'groups': results, 'ranking_changed': False, 'original_ranking': [column], 'dp_ranking': [column]})

    if statistic == 'mean':
        grouped = df.groupby(group_by)[column].apply(lambda x: pd.to_numeric(x, errors='coerce').dropna().mean())
        dp_grouped = grouped.apply(lambda x: laplace_mech.randomise(x))
    elif statistic == 'count':
        grouped = df.groupby(group_by)[column].count()
        dp_grouped = grouped.apply(lambda x: laplace_mech.randomise(x))
    elif statistic == 'percent':
        def percent_func(g):
            total = len(g)
            pos = ((g[column] == 1) | (g[column] == '1')).sum()
            return pos / total if total > 0 else 0
        grouped = df.groupby(group_by).apply(percent_func)
        dp_grouped = grouped.apply(lambda x: np.clip(laplace_mech.randomise(x), 0, 1))
    else:
        return jsonify({'error': 'Unknown statistic'}), 400

    original_ranking = grouped.sort_values(ascending=False).index.tolist()
    dp_ranking = dp_grouped.sort_values(ascending=False).index.tolist()
    ranking_changed = original_ranking != dp_ranking

    for group in grouped.index:
        results.append({
            'name': group,
            'original': float(grouped[group]),
            'dp': float(dp_grouped[group])
        })

    return jsonify({
        'groups': results,
        'ranking_changed': ranking_changed,
        'original_ranking': original_ranking,
        'dp_ranking': dp_ranking
    })

@main.route('/api/train-model', methods=['POST'])
def train_model():
    data = request.get_json()
    X = np.array(data['features'])
    y = np.array(data['labels'])
    epsilon = float(data['epsilon'])
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    
    original_model = LogisticRegression()
    original_model.fit(X_train, y_train)
    original_score = original_model.score(X_test, y_test)
    
    laplace_mech = mechanisms.Laplace(epsilon=epsilon, sensitivity=1.0)
    X_train_dp = np.array([[laplace_mech.randomise(x_i) for x_i in x] for x in X_train])
    
    dp_model = LogisticRegression()
    dp_model.fit(X_train_dp, y_train)
    dp_score = dp_model.score(X_test, y_test)
    
    return jsonify({
        'original_accuracy': float(original_score),
        'dp_accuracy': float(dp_score)
    })

@main.route('/api/compute-error-bars', methods=['POST'])
def compute_error_bars():
    data = request.get_json()
    df = pd.DataFrame(data['data'])
    epsilon = float(data['epsilon'])
    group_by = data['group_by']
    statistic = data['statistic']
    column = data['column']
    num_simulations = int(data.get('num_simulations', 100))

    laplace_mech = mechanisms.Laplace(epsilon=epsilon, sensitivity=1.0)
    results = {}

    if not group_by:
        # No grouping: just compute for the whole column
        series = pd.to_numeric(df[column], errors='coerce').dropna()
        orig = None
        if statistic == 'mean':
            orig = series.mean()
        elif statistic == 'count':
            orig = series.count()
        elif statistic == 'percent':
            pos = ((series == 1) | (series == '1')).sum()
            orig = pos / len(series) if len(series) > 0 else 0
        else:
            return jsonify({'error': 'Unknown statistic'}), 400
        samples = [laplace_mech.randomise(orig) for _ in range(num_simulations)]
        mean = float(np.mean(samples))
        std = float(np.std(samples))
        results[column] = {'mean': mean, 'std': std, 'orig': float(orig)}
    else:
        # Grouped case
        if statistic == 'mean':
            grouped = df.groupby(group_by)[column].apply(lambda x: pd.to_numeric(x, errors='coerce').dropna().mean())
        elif statistic == 'count':
            grouped = df.groupby(group_by)[column].count()
        elif statistic == 'percent':
            grouped = df.groupby(group_by)[column].apply(lambda x: ((x == 1) | (x == '1')).sum() / len(x) if len(x) > 0 else 0)
        else:
            return jsonify({'error': 'Unknown statistic'}), 400
        for group in grouped.index:
            orig = grouped[group]
            samples = [laplace_mech.randomise(orig) for _ in range(num_simulations)]
            mean = float(np.mean(samples))
            std = float(np.std(samples))
            results[group] = {'mean': mean, 'std': std, 'orig': float(orig)}

    return jsonify({'error_bars': results, 'timestamp': time.time()})
