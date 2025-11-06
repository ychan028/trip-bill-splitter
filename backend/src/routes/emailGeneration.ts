import express from 'express';
import { generatePersonalizedEmails } from '../services/emailGenerator';
import { GenerationRequest } from '../types/contact';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { productInfo, contactContext, contacts }: GenerationRequest = req.body;

    if (!productInfo || !contactContext || !contacts || contacts.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: productInfo, contactContext, and contacts'
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'Anthropic API key not configured'
      });
    }

    const generatedEmails = await generatePersonalizedEmails({
      productInfo,
      contactContext,
      contacts
    });

    res.json({
      success: true,
      emails: generatedEmails,
      count: generatedEmails.length
    });
  } catch (error: any) {
    console.error('Email generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as emailGenerationRouter };
