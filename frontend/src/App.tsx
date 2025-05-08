import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Slider, 
  Paper,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import { Bar, Line } from 'react-chartjs-2';
import axios from 'axios';
import ResultsDashboard from './ResultsDashboard';
import Papa from 'papaparse';
import 'chartjs-chart-error-bars';
import { BarWithErrorBarsController, BarWithErrorBar } from 'chartjs-chart-error-bars';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarWithErrorBarsController,
  BarWithErrorBar
);

const STATISTICS = [
  { value: 'mean', label: 'Mean' },
  { value: 'count', label: 'Count' },
  { value: 'percent', label: 'Percent' }
];

const LOCAL_STORAGE_CSV_KEY = 'dp_explorer_uploaded_csv';

const App: React.FC = () => {
  const [epsilon, setEpsilon] = useState<number>(1.0);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string>('');
  const [statistic, setStatistic] = useState<string>('percent');
  const [measureColumn, setMeasureColumn] = useState<string>('');
  const [results, setResults] = useState<any>(null);
  const [dpWarning, setDpWarning] = useState<boolean>(false);
  const [trueRanking, setTrueRanking] = useState<string[]>([]);
  const [dpRanking, setDpRanking] = useState<string[]>([]);
  const [errorBarData, setErrorBarData] = useState<any>(null);
  const [tradeoffData, setTradeoffData] = useState<{epsilon: number, rmse: number}[]>([]);
  const errorBarInterval = useRef<NodeJS.Timeout | null>(null);
  const [ciBarData, setCiBarData] = useState<any>(null);

  // Fetch confidence interval bar data
  const fetchConfidenceIntervalData = async () => {
    try {
      const resp = await axios.post('http://localhost:5050/api/compute-error-bars', {
        data,
        epsilon,
        group_by: groupBy,
        statistic,
        column: measureColumn,
        num_simulations: 100
      });
      setCiBarData(resp.data.error_bars);
    } catch (e) {
      console.error('Error fetching CI bar data:', e);
    }
  };

  useEffect(() => {
    if (data.length > 0 && groupBy && measureColumn && statistic && epsilon) {
      fetchConfidenceIntervalData();
    }
    // eslint-disable-next-line
  }, [data, groupBy, measureColumn, statistic, epsilon]);

  let ciBarChartData: any = null;

  let ciBarGroups: string[] = [];
  if (ciBarData) {
    ciBarGroups = Object.keys(ciBarData);
    if (ciBarGroups.length > 0) {
      ciBarChartData = {
        labels: ciBarGroups,
        datasets: [
          {
            type: 'barWithErrorBars',
            label: 'DP ' + (measureColumn ? measureColumn.charAt(0).toUpperCase() + measureColumn.slice(1) : 'Statistic'),
            data: ciBarGroups.map(g => ({
              y: ciBarData[g].mean,
              yMin: Number(ciBarData[g].mean ?? 0) - 1.96 * Number(ciBarData[g].std ?? 0),
              yMax: Number(ciBarData[g].mean ?? 0) + 1.96 * Number(ciBarData[g].std ?? 0)
            })),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          }
        ]
      };
    }
  }
  

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        localStorage.setItem(LOCAL_STORAGE_CSV_KEY, text);
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            setData(result.data as any[]);
            if (result.meta.fields) setColumns(result.meta.fields as string[]);
            setGroupBy('');
            setMeasureColumn('');
          },
        });
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    const savedCsv = localStorage.getItem(LOCAL_STORAGE_CSV_KEY);
    if (savedCsv) {
      Papa.parse(savedCsv, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setData(result.data as any[]);
          if (result.meta.fields) setColumns(result.meta.fields as string[]);
          setGroupBy('');
          setMeasureColumn('');
        },
      });
    }
  }, []);

  const computeStats = async () => {
    try {
      const response = await axios.post('http://localhost:5050/api/compute-stats', {
        data,
        epsilon,
        group_by: groupBy,
        statistic,
        column: measureColumn
      });
      setResults(response.data);
      setDpWarning(response.data.ranking_changed);
      setTrueRanking(response.data.original_ranking || []);
      setDpRanking(response.data.dp_ranking || []);
    } catch (error) {
      console.error('Error computing stats:', error);
    }
  };

  useEffect(() => {
    if (data.length > 0 && groupBy && measureColumn && statistic && epsilon) {
      if (errorBarInterval.current) clearInterval(errorBarInterval.current);
      const poll = async () => {
        try {
          const resp = await axios.post('http://localhost:5050/api/compute-error-bars', {
            data,
            epsilon,
            group_by: groupBy,
            statistic,
            column: measureColumn,
            num_simulations: 100
          });
          setErrorBarData(resp.data.error_bars);
        } catch (e) {
          setErrorBarData(null);
        }
      };
      poll();
      errorBarInterval.current = setInterval(poll, 1000);
      return () => {
        if (errorBarInterval.current) clearInterval(errorBarInterval.current);
      };
    }
    return () => {
      if (errorBarInterval.current) clearInterval(errorBarInterval.current);
    };
  }, [data, groupBy, measureColumn, statistic, epsilon]);

  useEffect(() => {
    const computeTradeoff = async () => {
      if (!data.length || !groupBy || !measureColumn || !statistic) return;
      const epsilons = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0];
      const newTradeoff: {epsilon: number, rmse: number}[] = [];
      for (const eps of epsilons) {
        try {
          const resp = await axios.post('http://localhost:5050/api/compute-error-bars', {
            data,
            epsilon: eps,
            group_by: groupBy,
            statistic,
            column: measureColumn,
            num_simulations: 100
          });
          const errorBars = resp.data.error_bars;
          const groupKeys = Object.keys(errorBars);
          // Compute RMSE between DP mean and true value for each group
          let sumSq = 0;
          let n = 0;
          for (const g of groupKeys) {
            const dpMean = errorBars[g].mean;
            const orig = errorBars[g].orig;
            sumSq += (dpMean - orig) ** 2;
            n += 1;
          }
          const rmse = n > 0 ? Math.sqrt(sumSq / n) : 0;
          newTradeoff.push({ epsilon: eps, rmse });
        } catch (e) {
          // skip this epsilon if error
        }
      }
      setTradeoffData(newTradeoff);
    };
    computeTradeoff();
  }, [data, groupBy, measureColumn, statistic]);

  let errorBarChartData = null;
  let errorBarGroups: string[] = [];
  if (errorBarData) {
    errorBarGroups = Object.keys(errorBarData);
    if (errorBarGroups.length > 0) {
      errorBarChartData = {
        labels: errorBarGroups,
        datasets: [
          {
            label: 'Error (Std Dev)',
            data: errorBarGroups.map(g => errorBarData[g].std),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      };
    }
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Differential Privacy Explorer
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Upload Dataset
              </Typography>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
              />
              {columns.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">Columns detected: {columns.join(', ')}</Typography>
                </Box>
              )}
              {/* Dropdowns for group by, statistic, and column */}
              {columns.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Group By</InputLabel>
                    <Select
                      value={groupBy}
                      label="Group By"
                      onChange={e => setGroupBy(e.target.value)}
                    >
                      {columns.map(col => (
                        <MenuItem key={col} value={col}>{col}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Statistic</InputLabel>
                    <Select
                      value={statistic}
                      label="Statistic"
                      onChange={e => setStatistic(e.target.value)}
                    >
                      {STATISTICS.map(stat => (
                        <MenuItem key={stat.value} value={stat.value}>{stat.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Column</InputLabel>
                    <Select
                      value={measureColumn}
                      label="Column"
                      onChange={e => setMeasureColumn(e.target.value)}
                    >
                      {columns.map(col => (
                        <MenuItem key={col} value={col}>{col}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Set Privacy Budget (Epsilon)
              </Typography>
              <Slider
                value={epsilon}
                min={0.01}
                max={10}
                step={0.01}
                onChange={(e, val) => setEpsilon(typeof val === 'number' ? val : val[0])}
                valueLabelDisplay="auto"
              />
              <Button 
                variant="contained" 
                sx={{ mt: 2 }} 
                onClick={computeStats} 
                disabled={data.length === 0 || !groupBy || !statistic || !measureColumn}
              >
                Compute Stats
              </Button>
            </Paper>
          </Grid>
        </Grid>
        {/* Results Section */}
        {dpWarning && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            Usability warning: Ranking order has changed due to differential privacy noise. The conclusions drawn from this data may be less reliable.
          </Alert>
        )}
        {results && results.groups && (
          <Grid item xs={12} sx={{ mt: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Results by {groupBy}
              </Typography>
              <Grid container spacing={2}>
                {results.groups.map((group: any) => (
                  <Grid item xs={12} sm={6} md={4} key={group.name}>
                    <Typography><b>{group.name}</b></Typography>
                    <Typography>Original: {group.original}</Typography>
                    <Typography>DP: {group.dp}</Typography>
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1"><b>True Ranking Order:</b> {trueRanking.join(' > ')}</Typography>
                <Typography variant="subtitle1"><b>DP Ranking Order:</b> {dpRanking.join(' > ')}</Typography>
              </Box>
              {ciBarChartData && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="subtitle1">
                    Confidence Interval Bar Plot (Epsilon {epsilon})
                  </Typography>
                  <Bar
                    data={ciBarChartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: true },
                        tooltip: {
                          callbacks: {
                            label: function(context: any) {
                              const value = context.raw;
                              if (value && typeof value === 'object') {
                                return `DP Mean: ${value.y.toFixed(3)} (95% CI: [${value.yMin.toFixed(3)}, ${value.yMax.toFixed(3)}])`;
                              }
                              return '';
                            }
                          }
                        }
                      },
                      scales: {
                        x: { title: { display: true, text: 'Group' } },
                        y: { title: { display: true, text: measureColumn ? measureColumn.charAt(0).toUpperCase() + measureColumn.slice(1) : 'Statistic' }, beginAtZero: true }
                      }
                    }}
                  />
                </Box>
              )}
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1">Animated Error Bar Plot (DP Variability for Epsilon {epsilon})</Typography>
                {errorBarChartData ? (
                  <Bar
                    data={errorBarChartData}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { title: { display: true, text: 'Group' } },
                        y: { title: { display: true, text: 'Error (Std Dev)' }, beginAtZero: true }
                      }
                    }}
                  />
                ) : (
                  <Typography color="textSecondary">No error bar data available yet.</Typography>
                )}
              </Box>
              <Box sx={{ mt: 6 }}>
                <Typography variant="subtitle1">Privacy vs. Accuracy Tradeoff Curve</Typography>
                {tradeoffData.length > 0 ? (
                  <Line
                    data={{
                      datasets: [
                        {
                          label: 'RMSE vs. Epsilon',
                          data: tradeoffData.map(d => ({ x: d.epsilon, y: d.rmse })),
                          borderColor: 'orange',
                          backgroundColor: 'rgba(255,165,0,0.3)',
                          fill: true,
                          tension: 0.2
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: true } },
                      scales: {
                        x: {
                          type: 'linear',
                          title: { display: true, text: 'Epsilon (Privacy Budget)' },
                          min: Math.min(...tradeoffData.map(d => d.epsilon)),
                          max: Math.max(...tradeoffData.map(d => d.epsilon)),
                          ticks: { stepSize: 0.1 }
                        },
                        y: { title: { display: true, text: 'RMSE (Accuracy Loss)' }, beginAtZero: true }
                      }
                    }}
                  />
                ) : (
                  <Typography color="textSecondary">No tradeoff data available yet.</Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        )}
      </Box>
    </Container>
  );
};

export default App;
