from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from diffprivlib.mechanisms import Laplace
from diffprivlib.tools import mean, histogram
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, log_loss

def dp_count(data, epsilon):
    mech = Laplace(epsilon=epsilon, sensitivity=1)
    return int(round(mech.randomise(len(data))))

app = Flask(__name__)
# Minimal, default CORS setup for all routes and methods
CORS(app)

# Catch-all OPTIONS handler for preflight CORS requests
@app.route('/api/<path:path>', methods=['OPTIONS'])
def options_handler(path):
    return '', 204

@app.route('/api/compute-stats', methods=['POST'])
def compute_stats():
    data = request.json['values']
    epsilon = float(request.json['epsilon'])
    print("[compute-stats] Received data:", data)
    print("[compute-stats] Received epsilon:", epsilon)
    data = np.array(data)
    dp_mean_val = mean(data, epsilon=epsilon, bounds=(float(data.min()), float(data.max())))
    dp_count_val = dp_count(data, epsilon)
    print("[compute-stats] DP mean:", dp_mean_val, "DP count:", dp_count_val)
    return jsonify({
        'original_mean': float(np.mean(data)),
        'original_count': int(len(data)),
        'dp_mean': float(dp_mean_val),
        'dp_count': int(dp_count_val)
    })

@app.route('/api/compute-multi-epsilon', methods=['POST'])
def compute_multi_epsilon():
    data = np.array(request.json['values'])
    epsilons = request.json['epsilons']
    print("[compute-multi-epsilon] Received data:", data)
    print("[compute-multi-epsilon] Received epsilons:", epsilons)
    results = []
    for epsilon in epsilons:
        epsilon = float(epsilon)
        dp_mean_val = None
        dp_count_val = None
        hist_dict = {}
        dp_error = None
        model_error = None
        accuracy = None
        loss = None
        try:
            try:
                dp_mean_val = mean(data, epsilon=epsilon, bounds=(float(data.min()), float(data.max())))
                dp_count_val = dp_count(data, epsilon)
                hist_vals, hist_bins = histogram(data, epsilon=epsilon, bins=5, range=(float(data.min()), float(data.max())))
                hist_dict = {f"{round(hist_bins[i], 2)}-{round(hist_bins[i+1], 2)}": int(hist_vals[i]) for i in range(len(hist_vals))}
            except Exception as dp_ex:
                dp_error = f"DP computation failed: {type(dp_ex).__name__}: {str(dp_ex)}"
                print(f"[compute-multi-epsilon] DP error for epsilon {epsilon}: {dp_error}")
            # Only attempt ML if DP stats succeeded
            if dp_error is None:
                try:
                    X = data.reshape(-1, 1)
                    y = (data > np.median(data)).astype(int)
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3)
                    clf = LogisticRegression()
                    if len(np.unique(y_train)) < 2:
                        model_error = 'Only one class in training set'
                        print(f"[compute-multi-epsilon] Skipping epsilon {epsilon}: only one class in y_train")
                    else:
                        clf.fit(X_train, y_train)
                        y_pred = clf.predict(X_test)
                        accuracy = accuracy_score(y_test, y_pred)
                        loss = log_loss(y_test, clf.predict_proba(X_test))
                        print(f"[compute-multi-epsilon] Epsilon: {epsilon}, DP mean: {dp_mean_val}, DP count: {dp_count_val}, Model accuracy: {accuracy}, loss: {loss}")
                except Exception as ml_ex:
                    model_error = f"Model computation failed: {type(ml_ex).__name__}: {str(ml_ex)}"
                    print(f"[compute-multi-epsilon] Model error for epsilon {epsilon}: {model_error}")
        except Exception as e:
            dp_error = f"Unknown error: {type(e).__name__}: {str(e)}"
            print(f"[compute-multi-epsilon] Unknown error for epsilon {epsilon}: {dp_error}")
        results.append({
            'epsilon': epsilon,
            'mean': float(dp_mean_val) if dp_mean_val is not None else None,
            'count': int(dp_count_val) if dp_count_val is not None else None,
            'histogram': hist_dict,
            'dp_error': dp_error,
            'model_performance': {
                'accuracy': float(accuracy) if accuracy is not None else None,
                'loss': float(loss) if loss is not None else None,
                'error': model_error
            }
        })
    return jsonify({'results': results})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)