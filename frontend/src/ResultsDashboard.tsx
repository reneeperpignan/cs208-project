import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Slider, Button, Paper, Grid, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { Line, Bar } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import 'chartjs-chart-error-bars';
import { BarWithErrorBarsController, BarWithErrorBar } from 'chartjs-chart-error-bars';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarWithErrorBarsController,
  BarWithErrorBar
);

interface ResultsDashboardProps {
  data: number[];
  column?: string;
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

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ data, column = '', defaultEpsilons = [0.1, 0.5, 1.0, 2.0, 5.0] }) => {
  const [epsilons, setEpsilons] = useState<number[]>(defaultEpsilons);
  const [results, setResults] = useState<DPResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [customEpsilon, setCustomEpsilon] = useState<number>(1.0);
  const [errorBarData, setErrorBarData] = useState<any>(null);
  const errorBarInterval = useRef<NodeJS.Timeout | null>(null);
  

  const handleAddEpsilon = () => {
    if (!epsilons.includes(customEpsilon)) {
      setEpsilons([...epsilons, customEpsilon].sort((a, b) => a - b));
    }
  };

  const handleEpsilonChange = (event: any, value: number | number[]) => {
    setCustomEpsilon(typeof value === 'number' ? value : value[0]);
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const promises = epsilons.map(async (epsilon) => {
        const response = await axios.post('http://localhost:5050/api/compute-stats', {
          data: data.map(v => ({ [column]: v })),
          epsilon,
          group_by: null,
          statistic: 'mean', 
          column: column
        });
        return {
          epsilon,
          mean: response.data.groups[0]?.dp ?? null,
          count: response.data.groups[0]?.dp ?? null, 
          histogram: {},
          model_performance: undefined
        };
      });
      const allResults = await Promise.all(promises);
      setResults(allResults);
    } catch (error) {
      console.error('Error fetching DP results:', error);
    }
    setLoading(false);
  };

  

  const chartData = {
    labels: results.map((r) => r.epsilon),
    datasets: [
      {
        label: 'DP Mean',
        data: results.map((r) => r.mean),
        borderColor: 'blue',
        
      },
      {
        label: 'DP Count',
        data: results.map((r) => r.count),
        borderColor: 'green',
        
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
            {results.map((r) => (
              <Grid item xs={12} md={4} key={`hist-${r.epsilon}`}>
                <Typography variant="subtitle1">Epsilon: {r.epsilon}</Typography>
                <Bar 
                  data={{
                    labels: Object.keys(r.histogram),
                    datasets: [
                      {
                        label: `DP Histogram (Epsilon: ${r.epsilon})`,
                        data: Object.values(r.histogram),
                        backgroundColor: 'rgba(75,192,192,0.6)',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { title: { display: true, text: 'Bin' } },
                      y: { title: { display: true, text: 'Count' }, beginAtZero: true }
                    }
                  }}
                />
              </Grid>
            ))}
          </Grid>
          
        </Box>
      )}

      <Box sx={{ mt: 6 }}>
        <Typography variant="h6">Animated Error Bar Plot (DP Variability for Epsilon {epsilons[0]})</Typography>
        {errorBarData ? (() => {
          const errorBarGroups = Object.keys(errorBarData);
          if (errorBarGroups.length === 0) {
            return <Typography color="textSecondary">No error bar data available yet.</Typography>;
          }
          const means = errorBarGroups.map(g => errorBarData[g].mean);
          const stds = errorBarGroups.map(g => errorBarData[g].std);
          const errorBarChartData = {
            labels: errorBarGroups,
            datasets: [
              {
                label: 'DP Mean',
                data: means,
                backgroundColor: 'rgba(255,99,132,0.5)',
                borderColor: 'rgba(255,99,132,1)',
                borderWidth: 1,
              }
            ],
          };
          return (
            <Bar data={errorBarChartData} options={{
              responsive: true,
              plugins: {
                legend: { display: true },
                tooltip: {
                  callbacks: {
                    label: function(context: any) {
                      const idx = context.dataIndex;
                      const mean = means[idx];
                      const std = stds[idx];
                      const lower = mean - 1.96 * std;
                      const upper = mean + 1.96 * std;
                      return `DP Mean: ${mean.toFixed(3)} (95% CI: [${lower.toFixed(3)}, ${upper.toFixed(3)}])`;
                    }
                  }
                }
              },
              scales: {
                x: { title: { display: true, text: 'Group' } },
                y: { title: { display: true, text: 'DP Statistic' }, beginAtZero: true }
              }
            }} />
          );
        })() : (
          <Typography color="textSecondary">No error bar data available yet.</Typography>
        )}
      </Box>

    </Paper>
  );
}

export default ResultsDashboard;
