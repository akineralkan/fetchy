// @vitest-environment jsdom
//
// Tests for GH-93: Interactive Onboarding Tour (src/components/OnboardingTour.tsx)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OnboardingTour from '../../src/components/OnboardingTour';

afterEach(() => {
  cleanup();
});

describe('OnboardingTour', () => {
  it('renders the first step (Welcome to Fetchy) on mount', () => {
    render(<OnboardingTour onComplete={vi.fn()} />);
    expect(screen.getByText('Welcome to Fetchy')).toBeTruthy();
  });

  it('renders exactly 5 progress dots', () => {
    const { container } = render(<OnboardingTour onComplete={vi.fn()} />);
    const dots = container.querySelectorAll('.rounded-full.transition-all');
    expect(dots.length).toBe(5);
  });

  it('does not show a Back button on the first step', () => {
    render(<OnboardingTour onComplete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('shows a Back button after advancing past the first step', () => {
    render(<OnboardingTour onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('advances to the next step content when Next is clicked', () => {
    render(<OnboardingTour onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Collections & Sidebar')).toBeTruthy();
    expect(screen.queryByText('Welcome to Fetchy')).toBeNull();
  });

  it('navigates back to the previous step content when Back is clicked', () => {
    render(<OnboardingTour onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Welcome to Fetchy')).toBeTruthy();
  });

  it('walks through all 5 steps in order via Next', () => {
    render(<OnboardingTour onComplete={vi.fn()} />);
    const titles = [
      'Welcome to Fetchy',
      'Collections & Sidebar',
      'Request & Response Panels',
      'Environments & Variables',
      'AI Assistant',
    ];
    expect(screen.getByText(titles[0])).toBeTruthy();
    for (let i = 1; i < titles.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText(titles[i])).toBeTruthy();
    }
  });

  it('shows "Get Started" instead of "Next" on the last step', () => {
    render(<OnboardingTour onComplete={vi.fn()} />);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    expect(screen.getByRole('button', { name: /get started/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^next$/i })).toBeNull();
  });

  it('calls onComplete when "Get Started" is clicked on the final step', () => {
    const onComplete = vi.fn();
    render(<OnboardingTour onComplete={onComplete} />);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when "Skip tour" is clicked', () => {
    const onComplete = vi.fn();
    render(<OnboardingTour onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Skip tour'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when the X (close) button is clicked', () => {
    const onComplete = vi.fn();
    render(<OnboardingTour onComplete={onComplete} />);
    fireEvent.click(screen.getByLabelText('Skip onboarding tour'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when Escape is pressed on the overlay', () => {
    const onComplete = vi.fn();
    const { container } = render(<OnboardingTour onComplete={onComplete} />);
    const overlay = container.firstChild as HTMLElement;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('advances to the next step when ArrowRight is pressed', () => {
    const { container } = render(<OnboardingTour onComplete={vi.fn()} />);
    const overlay = container.firstChild as HTMLElement;
    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    expect(screen.getByText('Collections & Sidebar')).toBeTruthy();
  });

  it('navigates back when ArrowLeft is pressed after moving forward', () => {
    const { container } = render(<OnboardingTour onComplete={vi.fn()} />);
    const overlay = container.firstChild as HTMLElement;
    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    fireEvent.keyDown(overlay, { key: 'ArrowLeft' });
    expect(screen.getByText('Welcome to Fetchy')).toBeTruthy();
  });

  it('does not go before the first step when ArrowLeft is pressed on step 1', () => {
    const { container } = render(<OnboardingTour onComplete={vi.fn()} />);
    const overlay = container.firstChild as HTMLElement;
    fireEvent.keyDown(overlay, { key: 'ArrowLeft' });
    expect(screen.getByText('Welcome to Fetchy')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('completes via ArrowRight when pressed on the final step', () => {
    const onComplete = vi.fn();
    const { container } = render(<OnboardingTour onComplete={onComplete} />);
    const overlay = container.firstChild as HTMLElement;
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    }
    expect(screen.getByRole('button', { name: /get started/i })).toBeTruthy();
    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
