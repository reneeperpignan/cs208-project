import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Slider, 
  Paper,
  Grid,
  Button
} from '@mui/material';
import { Line } from 'react-chartjs-2';
import axios from 'axios';
import ResultsDashboard from './ResultsDashboard';

const App: React.FC = () => {
  const [epsilon, setEpsilon] = useState<number>(1.0);
  const [data, setData] = useState<number[]>([]);
  const [results, setResults] = useState<any>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const numbers = text.split(',').map(Number);
        setData(numbers);
      };
      reader.readAsText(file);
    }
  };

  const computeStats = async () => {
    try {
      const response = await axios.post('http://localhost:5050/api/compute-stats', {
        values: data,
        epsilon
      });
      setResults(response.data);
    } catch (error) {
      console.error('Error computing stats:', error);
    }
  };

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
              <Button variant="contained" sx={{ mt: 2 }} onClick={computeStats} disabled={data.length === 0}>
                Compute Stats
              </Button>
            </Paper>
          </Grid>
        </Grid>
        {/* Results Dashboard Section */}


        {results && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Results
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography>Original Mean: {results.original_mean}</Typography>
                  <Typography>Original Count: {results.original_count}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography>DP Mean: {results.dp_mean}</Typography>
                  <Typography>DP Count: {results.dp_count}</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}
        <Box sx={{ mt: 4 }}>
          <ResultsDashboard data={data} />
        </Box>
      </Box>
    </Container>
  );
};

export default App;
