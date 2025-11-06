import { useState } from 'react';
import { Download, ArrowLeft, Copy, Check } from 'lucide-react';
import { GeneratedEmail } from '../types';
import * as XLSX from 'xlsx';

interface EmailReviewProps {
  emails: GeneratedEmail[];
  onReset: () => void;
  onBack: () => void;
}

export default function EmailReview({ emails, onReset, onBack }: EmailReviewProps) {
  const [selectedEmail, setSelectedEmail] = useState<GeneratedEmail | null>(
    emails.length > 0 ? emails[0] : null
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (email: GeneratedEmail, index: number) => {
    const text = `Subject: ${email.subjectLine}\n\n${email.emailMessage}`;
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleExportCSV = () => {
    const csvData = emails.map((email) => ({
      'First Name': email.contact.firstName,
      'Last Name': email.contact.lastName,
      'Email': email.contact.email,
      'Title': email.contact.title,
      'Seniority': email.contact.seniority,
      'Company': email.contact.company,
      'Company Industries': email.contact.companyIndustries,
      'Assets': email.contact.assets,
      'Phone Number': email.contact.phoneNumber,
      'Phone Type': email.contact.phoneType,
      'City': email.contact.city,
      'State': email.contact.state,
      'Country': email.contact.country,
      'Subject Line': email.subjectLine,
      'Email Message': email.emailMessage,
    }));

    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personalized Emails');
    XLSX.writeFile(workbook, 'personalized-emails.xlsx');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Review Generated Emails
          </h2>
          <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </button>
        </div>
        <p className="text-gray-600">
          {emails.length} personalized email{emails.length !== 1 ? 's' : ''} generated
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-gray-200">
        {/* Email List */}
        <div className="md:col-span-1 overflow-y-auto max-h-[600px]">
          {emails.map((email, index) => (
            <div
              key={index}
              onClick={() => setSelectedEmail(email)}
              className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
                selectedEmail === email
                  ? 'bg-blue-50 border-l-4 border-l-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {email.contact.firstName} {email.contact.lastName}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {email.contact.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {email.contact.company}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(email, index);
                  }}
                  className="ml-2 p-1 hover:bg-white rounded transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedIndex === index ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Email Preview */}
        <div className="md:col-span-2 p-6">
          {selectedEmail ? (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">
                      {selectedEmail.contact.firstName}{' '}
                      {selectedEmail.contact.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 font-medium">
                      {selectedEmail.contact.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Title:</span>
                    <span className="ml-2 font-medium">
                      {selectedEmail.contact.title}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Company:</span>
                    <span className="ml-2 font-medium">
                      {selectedEmail.contact.company}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Subject Line
                </h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-800">
                    {selectedEmail.subjectLine}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Email Message
                </h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800">
                    {selectedEmail.emailMessage}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Select an email to preview
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-gray-200 flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <button
          onClick={onReset}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start New Campaign
        </button>
      </div>
    </div>
  );
}
