# Differential Privacy Explorer

An interactive web-based tool for exploring differential privacy concepts and their impact on data analysis.

## Features

- Upload custom datasets (CSV format) or use sample datasets
- Compute privacy-preserving statistics (mean, count, histograms)
- Interactive privacy budget (ε) adjustment, including multi-epsilon analysis
- Real-time visualization of privacy-utility tradeoffs (charts, histograms)
- Downstream task simulation (logistic regression with/without DP noise)
- Support for multiple DP mechanisms (Laplace, Gaussian)
- Results dashboard for comparing DP and non-DP statistics

## Project Structure & File Navigation

```
dp-project/
├── .venv/                # Python virtual environment (do not edit)
├── README.md             # Project documentation and setup instructions
├── backend/              # Backend (Flask API and DP logic)
│   ├── app.py            # Main Flask app entry point
│   ├── requirements.txt  # Python dependencies
│   ├── app/              # Backend package
│   │   ├── __init__.py   # App factory and initialization
│   │   └── routes.py     # API endpoints for DP statistics and ML
│   └── tests/            # Backend tests
├── frontend/             # Frontend (React app)
│   ├── package.json      # Frontend dependencies and scripts
│   ├── src/              # React source code
│   │   ├── App.tsx       # Main React app logic
│   │   ├── ResultsDashboard.tsx # Dashboard for DP results and charts
│   │   └── index.tsx     # React entry point
│   └── public/           # Static assets and HTML
├── data/                 # Sample datasets (e.g., test.csv)
└── docs/                 # Documentation (currently empty)
```

### File/Folder Purposes

- **.venv/**: Isolated Python environment for dependencies (auto-created; do not modify).
- **README.md**: This file. Full setup, usage, and project overview.
- **backend/**: All backend code and dependencies.
  - **app.py**: Main Flask server. Run this to start the backend API.
  - **requirements.txt**: Python packages needed for backend.
  - **app/**: Python package for backend logic.
    - **__init__.py**: App factory, CORS setup, and blueprint registration.
    - **routes.py**: All API endpoints for computing DP statistics and ML tasks.
  - **tests/**: (If present) Unit and integration tests for backend.
- **frontend/**: All frontend code (React app).
  - **package.json**: JavaScript dependencies and scripts.
  - **src/**: Main React source files.
    - **App.tsx**: Main app logic and layout.
    - **ResultsDashboard.tsx**: Dashboard and charts for DP results.
    - **index.tsx**: React entry point.
  - **public/**: Static files and index.html.
- **data/**: Example datasets for testing/exploration.
- **docs/**: Place for additional documentation (currently empty).

## Environment Setup (One Time)

### 1. Create and Activate the Python Virtual Environment

In your project root directory:

```bash
python -m venv .venv  # do this only once
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### 2. Install Python Dependencies

Navigate to the backend directory and install requirements:

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

---

## Starting the App (Every Time You Work)

### 1. Activate the Python Virtual Environment

From your project root:

```bash
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### 2. Start the Backend Server

In a terminal, from the backend directory:

```bash
cd backend
python app.py
```

The backend will start on http://localhost:5050

### 3. Start the Frontend Development Server

In a new terminal window/tab:

```bash
cd frontend
npm start
```

The frontend will start on http://localhost:3000

---

## Current Features

- **Data Upload**: Upload your own CSV dataset or use provided samples.
- **DP Statistics**: Compute and compare original and differentially private mean and count.
- **Multi-Epsilon Analysis**: Select and compare results for multiple privacy budgets (ε values).
- **DP Histograms**: Visualize the impact of DP noise on data distributions.
- **Model Performance**: Simulate and compare logistic regression accuracy with/without DP noise.
- **Interactive Dashboard**: Adjust ε, view charts, and explore tradeoffs between privacy and utility.

---

## Collaborative Workflow: Branching, Pull Requests, and Merging

### Creating a New Branch and Pushing Changes

For each new feature or fix, follow these steps:

```bash
# 1. Make sure you are on main and pull the latest changes
git checkout main
git pull origin main

# 2. Create and switch to a new branch (replace feature/my-feature with a descriptive name)
git checkout -b feature/my-feature

# 3. Make your changes (edit files, add new files, etc.)

# 4. Stage all your changes for commit
git add .

# 5. Commit your changes with a helpful message
git commit -m "Describe what you changed"

# 6. Push your new branch to GitHub
git push -u origin feature/my-feature
```

After pushing, go to GitHub and open a Pull Request to merge your branch into main.

### Once changes have been merged by repo owner, do this:

git checkout main
git pull
git branch -d feature/my-feature

(Switches to main branch, pulls the merge, then deletes old branch)
---

### Merging a Completed Branch into main (as the repo owner/maintainer)

Once a Pull Request is reviewed and approved (or if merging locally):

```bash
# 1. Make sure your local main is up to date
git checkout main
git pull origin main

# 2. Merge the feature branch (replace feature/my-feature)
git merge feature/my-feature

# 3. Push the updated main branch to GitHub
git push origin main
```

---

### Deleting a Branch After Merge

Once the changes are merged and no longer needed:

```bash
# Delete the branch locally
git branch -d feature/my-feature

# Delete the branch from GitHub
git push origin --delete feature/my-feature
```

---

**Tip:** Always use descriptive branch names and commit messages. Keep your main branch clean—never commit directly to main.

---

## Development

The application uses:
- Frontend: React with TypeScript, Material UI, Chart.js
- Backend: Python Flask with diffprivlib, scikit-learn

## License

MIT License
