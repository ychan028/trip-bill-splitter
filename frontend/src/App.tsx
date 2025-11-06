import { useState } from 'react';
import { Contact, GeneratedEmail, Step } from './types';
import FileUpload from './components/FileUpload';
import ConfigurationForm from './components/ConfigurationForm';
import GenerationProgress from './components/GenerationProgress';
import EmailReview from './components/EmailReview';
import StepIndicator from './components/StepIndicator';

function App() {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [productInfo, setProductInfo] = useState('');
  const [contactContext, setContactContext] = useState('');
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileUploaded = (uploadedContacts: Contact[]) => {
    setContacts(uploadedContacts);
    setCurrentStep('configure');
  };

  const handleConfigurationSubmit = async (product: string, context: string) => {
    setProductInfo(product);
    setContactContext(context);
    setCurrentStep('generate');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productInfo: product,
          contactContext: context,
          contacts,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate emails');
      }

      const data = await response.json();
      setGeneratedEmails(data.emails);
      setCurrentStep('review');
    } catch (error) {
      console.error('Error generating emails:', error);
      alert('Failed to generate emails. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setContacts([]);
    setProductInfo('');
    setContactContext('');
    setGeneratedEmails([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            B2B Email Personalizer
          </h1>
          <p className="text-gray-600">
            Generate personalized email campaigns powered by AI
          </p>
        </header>

        <StepIndicator currentStep={currentStep} />

        <div className="max-w-5xl mx-auto">
          {currentStep === 'upload' && (
            <FileUpload onFileUploaded={handleFileUploaded} />
          )}

          {currentStep === 'configure' && (
            <ConfigurationForm
              onSubmit={handleConfigurationSubmit}
              contactCount={contacts.length}
              onBack={() => setCurrentStep('upload')}
            />
          )}

          {currentStep === 'generate' && (
            <GenerationProgress
              isGenerating={isGenerating}
              totalContacts={contacts.length}
            />
          )}

          {currentStep === 'review' && (
            <EmailReview
              emails={generatedEmails}
              onReset={handleReset}
              onBack={() => setCurrentStep('configure')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
