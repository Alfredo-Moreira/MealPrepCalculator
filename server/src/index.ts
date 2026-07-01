import express from 'express';
import cors from 'cors';
import path from 'path';
import { connectDb } from './db';
import { planRoutes } from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '6mb' })); // headroom for resized progress photos (base64)

app.use('/api/v1', planRoutes);
app.use('/api', planRoutes); // back-compat alias (un-versioned clients)

// Serve static files in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
