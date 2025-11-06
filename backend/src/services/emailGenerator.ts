import Anthropic from '@anthropic-ai/sdk';
import { Contact, GeneratedEmail, PersonalizationInput } from '../types/contact';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function createPersonalizationPrompt(
  contact: Contact,
  productInfo: string,
  contactContext: string
): string {
  return `You are an expert B2B email marketing specialist. Create a personalized cold email for the following contact.

PRODUCT/SERVICE INFORMATION:
${productInfo}

CAMPAIGN CONTEXT:
${contactContext}

CONTACT DETAILS:
- Name: ${contact.firstName} ${contact.lastName}
- Title: ${contact.title}
- Seniority: ${contact.seniority}
- Company: ${contact.company}
- Industry: ${contact.companyIndustries}
- Location: ${contact.city}, ${contact.state}, ${contact.country}

REQUIREMENTS:
1. Create a compelling subject line (max 60 characters) that:
   - Is personalized to the contact
   - Creates curiosity or urgency
   - Relates to their role, industry, or company

2. Write a personalized email message (150-200 words) that:
   - Addresses them by first name
   - References their specific role, company, or industry
   - Clearly explains the value proposition for THEIR specific situation
   - Includes a clear call-to-action
   - Is professional yet conversational
   - Avoids generic sales language

Return ONLY a JSON object with this exact structure:
{
  "subjectLine": "your subject line here",
  "emailMessage": "your email message here"
}

Do not include any other text, explanations, or markdown formatting.`;
}

async function generateEmailForContact(
  contact: Contact,
  productInfo: string,
  contactContext: string
): Promise<GeneratedEmail> {
  try {
    const prompt = createPersonalizationPrompt(contact, productInfo, contactContext);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON response
    const result = JSON.parse(responseText);

    return {
      contact,
      subjectLine: result.subjectLine,
      emailMessage: result.emailMessage
    };
  } catch (error: any) {
    console.error(`Error generating email for ${contact.email}:`, error);

    // Return a fallback email if generation fails
    return {
      contact,
      subjectLine: `Regarding ${contact.company}`,
      emailMessage: `Dear ${contact.firstName},\n\nI hope this email finds you well.\n\n[Error: Could not generate personalized content - ${error.message}]`
    };
  }
}

export async function generatePersonalizedEmails(
  input: PersonalizationInput
): Promise<GeneratedEmail[]> {
  const { productInfo, contactContext, contacts } = input;

  const generatedEmails: GeneratedEmail[] = [];

  // Process contacts in batches to respect rate limits
  const batchSize = 5;
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);

    const batchPromises = batch.map(contact =>
      generateEmailForContact(contact, productInfo, contactContext)
    );

    const batchResults = await Promise.all(batchPromises);
    generatedEmails.push(...batchResults);

    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return generatedEmails;
}
