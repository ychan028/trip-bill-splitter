import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface ConfigurationFormProps {
  onSubmit: (productInfo: string, contactContext: string) => void;
  contactCount: number;
  onBack: () => void;
}

export default function ConfigurationForm({
  onSubmit,
  contactCount,
  onBack,
}: ConfigurationFormProps) {
  const [productInfo, setProductInfo] = useState('');
  const [contactContext, setContactContext] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productInfo.trim() && contactContext.trim()) {
      onSubmit(productInfo, contactContext);
    }
  };

  const isValid = productInfo.trim().length > 0 && contactContext.trim().length > 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Configure Your Campaign
      </h2>
      <p className="text-gray-600 mb-6">
        Provide details about your product and campaign context to personalize
        emails for {contactCount} contacts
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label
            htmlFor="productInfo"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Product/Service Information
          </label>
          <textarea
            id="productInfo"
            value={productInfo}
            onChange={(e) => setProductInfo(e.target.value)}
            placeholder="Describe your product or service: features, benefits, use cases, unique selling points..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={6}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Be specific about features, benefits, and what makes your solution unique
          </p>
        </div>

        <div className="mb-6">
          <label
            htmlFor="contactContext"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Campaign Context
          </label>
          <textarea
            id="contactContext"
            value={contactContext}
            onChange={(e) => setContactContext(e.target.value)}
            placeholder="Provide campaign details: goals, value propositions, pain points you're addressing, call-to-action..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={6}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Include campaign goals, key messages, and desired outcomes
          </p>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>

          <button
            type="submit"
            disabled={!isValid}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Generate Emails
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
}
