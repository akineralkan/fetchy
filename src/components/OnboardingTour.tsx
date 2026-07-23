import { useState } from 'react';
import { X, Zap, FolderTree, Send, Globe, Bot, ArrowLeft, ArrowRight } from 'lucide-react';

interface OnboardingTourProps {
  onComplete: () => void;
}

interface OnboardingStep {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: Zap,
    iconColor: 'text-fetchy-accent',
    title: 'Welcome to Fetchy',
    description:
      'Fetchy is a privacy-focused, self-hosted REST API client. Everything runs locally on your machine \u2014 no cloud sync, no telemetry. Let\u2019s take a quick tour of the main features.',
  },
  {
    icon: FolderTree,
    iconColor: 'text-yellow-400',
    title: 'Collections & Sidebar',
    description:
      'Organize your requests into collections and folders in the sidebar. Drag and drop to reorder, import from Postman/Bruno/Hoppscotch/OpenAPI, or start a new collection from scratch.',
  },
  {
    icon: Send,
    iconColor: 'text-purple-400',
    title: 'Request & Response Panels',
    description:
      'Build requests with the request panel \u2014 headers, body, auth, scripts \u2014 and inspect responses side by side. Switch between a horizontal or vertical layout to fit your workflow.',
  },
  {
    icon: Globe,
    iconColor: 'text-fetchy-info',
    title: 'Environments & Variables',
    description:
      'Use <<variable>> syntax to switch between environments (dev, staging, prod) without editing your requests. Variables resolve from the environment, collection, or global scope.',
  },
  {
    icon: Bot,
    iconColor: 'text-fetchy-ai',
    title: 'AI Assistant',
    description:
      'Ask the built-in AI assistant to help write requests, explain responses, or debug errors. Configure your preferred provider anytime from Settings \u2192 AI Assistant.',
  },
];

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];
  const Icon = step.icon;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) setStepIndex((i) => i - 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onComplete();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handleBack();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-end px-4 pt-4">
          <button
            onClick={onComplete}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
            aria-label="Skip onboarding tour"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center text-center px-8 pb-6 pt-2">
          <div className="w-14 h-14 rounded-full bg-fetchy-card border border-fetchy-border flex items-center justify-center mb-4">
            <Icon className={step.iconColor} size={28} />
          </div>
          <h2 className="text-lg font-semibold text-fetchy-text mb-2">{step.title}</h2>
          <p className="text-sm text-fetchy-text-muted leading-relaxed">{step.description}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? 'w-5 bg-fetchy-accent' : 'w-1.5 bg-fetchy-border'
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-fetchy-border">
          <button
            onClick={onComplete}
            className="text-xs text-fetchy-text-muted hover:text-fetchy-text"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-fetchy-card border border-fetchy-border rounded hover:border-fetchy-accent transition-colors text-fetchy-text"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 text-sm bg-fetchy-accent hover:bg-fetchy-accent-hover text-white rounded transition-colors"
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
