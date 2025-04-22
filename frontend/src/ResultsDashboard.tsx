import React, { useState } from 'react';
import { Box, Typography, Slider, Button, Paper, Grid, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { Line, Bar } from 'react-chartjs-2';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,      // <-- Add this
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,      // <-- And register it here
  Title,
  Tooltip,
  Legend
);

interface ResultsDashboardProps {
  data: number[];
  defaultEpsilons?: number[];
}

interface DPResult {
  epsilon: number;
  mean: number;
  count: number;
  histogram: { [bin: string]: number };
  model_performance?: {
    accuracy: number;
    loss: number;
  };
}

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ data, defaultEpsilons = [0.1, 0.5, 1.0, 2.0, 5.0] }) => {
  const [epsilons, setEpsilons] = useState<number[]>(defaultEpsilons);
  const [results, setResults] = useState<DPResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [customEpsilon, setCustomEpsilon] = useState<number>(1.0);

  const handleAddEpsilon = () => {
    if (!epsilons.includes(customEpsilon)) {
      setEpsilons([...epsilons, customEpsilon].sort((a, b) => a - b));
    }
  };

  const handleEpsilonChange = (event: any, value: number | number[]) => {
    setCustomEpsilon(typeof value === 'number' ? value : value[0]);
  };

  const fetchResults = async () => {
    console.log("Fetching results", data, epsilons)
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5050/api/compute-multi-epsilon', {
        values: data,
        epsilons,
      });
      console.log("Results from backend", response.data.results)
      setResults(response.data.results);
    } catch (error) {
      console.error('Error fetching DP results:', error);
    }
    setLoading(false);
  };

  // Prepare data for charts
  const chartData = {
    labels: results.map((r) => r.epsilon),
    datasets: [
      {
        label: 'DP Mean',
        data: results.map((r) => r.mean),
        borderColor: 'blue',
        fill: false,
      },
      {
        label: 'DP Count',
        data: results.map((r) => r.count),
        borderColor: 'green',
        fill: false,
      },
    ],
  };

  const accuracyData = {
    labels: results.map((r) => r.epsilon),
    datasets: [
      {
        label: 'Model Accuracy',
        data: results.map((r) => r.model_performance?.accuracy ?? null),
        borderColor: 'purple',
        fill: false,
      },
    ],
  };

  return (
    <Paper sx={{ p: 3, mt: 4 }} elevation={3}>
      <Typography variant="h5" gutterBottom>
        Results Dashboard
      </Typography>
      <Typography gutterBottom>
        Explore how different privacy budgets (epsilon) affect your data and downstream tasks.
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Add Epsilon Value</Typography>
          <Slider
            value={customEpsilon}
            min={0.01}
            max={10}
            step={0.01}
            onChange={handleEpsilonChange}
            valueLabelDisplay="auto"
          />
          <Button variant="outlined" onClick={handleAddEpsilon}>Add Epsilon</Button>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Selected epsilons: {epsilons.join(', ')}
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button variant="contained" onClick={fetchResults} disabled={loading || data.length === 0}>
            Compute Results
          </Button>
        </Grid>
      </Grid>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && results.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">DP Statistics Table</Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Epsilon</TableCell>
                <TableCell>DP Mean</TableCell>
                <TableCell>DP Count</TableCell>
                <TableCell>Accuracy</TableCell>
                <TableCell>Loss</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.epsilon}>
                  <TableCell>{r.epsilon}</TableCell>
                  <TableCell>{r.mean}</TableCell>
                  <TableCell>{r.count}</TableCell>
                  <TableCell>{r.model_performance?.accuracy ?? 'N/A'}</TableCell>
                  <TableCell>{r.model_performance?.loss ?? 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {!loading && results.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">DP Statistics vs Epsilon</Typography>
          <Line data={chartData} />
        </Box>
      )}

      {!loading && results.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Model Performance vs Epsilon</Typography>
          <Line data={accuracyData} />
        </Box>
      )}

      {!loading && results.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Histograms</Typography>
          <Grid container spacing={2}>
            {results.map((r) => {
              const bins = Object.keys(r.histogram);
              const counts = Object.values(r.histogram);
              const barData = {
                labels: bins,
                datasets: [
                  {
                    label: `DP Histogram (Epsilon: ${r.epsilon})`,
                    data: counts,
                    backgroundColor: 'rgba(75,192,192,0.6)',
                  },
                ],
              };
              return (
                <Grid item xs={12} md={4} key={`hist-${r.epsilon}`}>
                  <Typography variant="subtitle1">Epsilon: {r.epsilon}</Typography>
                  <Bar data={barData} options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { title: { display: true, text: 'Bin' } },
                      y: { title: { display: true, text: 'Count' }, beginAtZero: true }
                    }
                  }} />
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Paper>
  );
};

export default ResultsDashboard;
