import { Step } from '../types';
import { CheckCircle, Circle } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: Step;
}

const steps: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload Contacts' },
  { id: 'configure', label: 'Configure Campaign' },
  { id: 'generate', label: 'Generate Emails' },
  { id: 'review', label: 'Review & Export' },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center space-x-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </div>
                <span
                  className={`mt-2 text-sm font-medium ${
                    isCurrent ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
