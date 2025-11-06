import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileUploadRouter } from './routes/fileUpload';
import { emailGenerationRouter } from './routes/emailGeneration';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory
const uploadsDir = path.join(__dirname, '../uploads');

// Routes
app.use('/api/upload', fileUploadRouter);
app.use('/api/generate', emailGenerationRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'B2B Email Personalizer API is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
