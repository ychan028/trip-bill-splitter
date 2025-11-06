# B2B Email Personalizer

An AI-powered tool that generates personalized email subject lines and messages for B2B outreach campaigns using Anthropic's Claude AI.

## Features

- **File Upload**: Support for CSV and Excel files with contact information
- **Smart Parsing**: Automatically maps contact fields with flexible column naming
- **AI Personalization**: Uses Claude AI to generate unique, personalized emails for each contact
- **Batch Processing**: Efficiently processes large contact lists with rate limiting
- **Export Functionality**: Download results as Excel files with all original data plus generated content
- **Multi-step Workflow**: Intuitive UI guiding you through upload, configuration, generation, and review

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Anthropic API key ([Get one here](https://console.anthropic.com/))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd powertown-site-locator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
PORT=3001
```

## Usage

### Development Mode

Run both frontend and backend in development mode:

```bash
npm run dev
```

This will start:
- Frontend on http://localhost:3000
- Backend API on http://localhost:3001

### Building for Production

Build the frontend:
```bash
npm run build
```

Build the backend:
```bash
npm run build:backend
```

## File Format

Your CSV or Excel file should include the following columns (case-insensitive):

- First Name
- Last Name
- Title
- Seniority
- Company
- Company Industries
- Assets
- Email
- Phone Number
- Phone Type
- City
- State
- Country

**Note**: The parser is flexible with column names. For example, "First Name", "FirstName", and "first name" will all work.

## How It Works

1. **Upload**: Upload a CSV or Excel file with your contact list
2. **Configure**: Provide product information and campaign context
3. **Generate**: AI generates personalized subject lines and email messages for each contact
4. **Review**: Review, edit, and export the generated emails

## API Endpoints

### POST /api/upload
Upload and parse contact file
- **Body**: multipart/form-data with 'file' field
- **Response**: `{ success: true, contacts: Contact[], count: number }`

### POST /api/generate
Generate personalized emails
- **Body**: `{ productInfo: string, contactContext: string, contacts: Contact[] }`
- **Response**: `{ success: true, emails: GeneratedEmail[], count: number }`

## Project Structure

```
powertown-site-locator/
├── backend/                 # Express API server
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── types/          # TypeScript types
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.tsx         # Main application
│   │   └── types.ts        # TypeScript types
│   └── package.json
└── package.json            # Root package.json

```

## Technologies Used

### Backend
- Node.js + Express
- TypeScript
- Anthropic Claude AI API
- Papa Parse (CSV parsing)
- SheetJS (Excel parsing)
- Multer (file uploads)

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide Icons
- SheetJS (Excel export)

## Sample Data

A sample CSV file is included in `sample-contacts.csv` for testing purposes.

## Rate Limiting

The application processes contacts in batches of 5 with a 1-second delay between batches to respect Anthropic's API rate limits.

## Error Handling

- File upload validation (file type, size)
- Contact data validation (required fields)
- API error handling with fallback messages
- User-friendly error messages

## License

MIT

## Support

For issues or questions, please open an issue on the GitHub repository.