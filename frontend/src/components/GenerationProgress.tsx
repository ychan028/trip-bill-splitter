import { Loader2 } from 'lucide-react';

interface GenerationProgressProps {
  isGenerating: boolean;
  totalContacts: number;
}

export default function GenerationProgress({
  isGenerating,
  totalContacts,
}: GenerationProgressProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-12">
      <div className="text-center">
        <Loader2 className="w-16 h-16 mx-auto mb-6 text-blue-600 animate-spin" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Generating Personalized Emails
        </h2>
        <p className="text-gray-600 mb-4">
          Creating {totalContacts} personalized email{totalContacts !== 1 ? 's' : ''}...
        </p>
        <p className="text-sm text-gray-500">
          This may take a few moments. Please don't close this window.
        </p>
      </div>
    </div>
  );
}
