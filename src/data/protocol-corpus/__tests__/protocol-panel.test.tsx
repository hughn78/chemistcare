// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProtocolPanel } from '@/components/protocols/ProtocolPanel';

describe('ProtocolPanel (jsdom smoke)', () => {
  it('renders the jurisdiction switcher and instrument for a corpus condition', () => {
    render(<ProtocolPanel conditionSlug="uncomplicated-uti" state="VIC" compact />);
    // All seven corpus jurisdictions for UTI appear as switcher chips
    for (const st of ['ACT', 'NSW', 'NT', 'QLD', 'TAS', 'VIC', 'WA']) {
      expect(screen.getByRole('button', { name: st })).toBeTruthy();
    }
    const body = document.body.textContent || '';
    expect(body).toMatch(/urinary tract infection/i);
    expect(body).toContain('Victoria');
  });

  it('expands an instrument to show eligibility, red flags, treatments, provenance', () => {
    render(<ProtocolPanel conditionSlug="mild-moderate-acne" state="QLD" compact />);
    // Open the first (and only) instrument card by clicking its title
    const title = screen.getByText(/Mild to Moderate Acne - Clinical Practice Guideline/);
    fireEvent.click(title);
    const body = document.body.textContent || '';
    expect(body).toContain('Inclusion');
    expect(body).toContain('Red flags (live)');
    expect(body).toContain('Suggested treatments');
    expect(body).toContain('sha256');
    expect(body).toMatch(/corpus as at 2026-09-25/);
    // Confidence badges render from extraction data
    expect(body).toContain('high');
  });

  it('fires a live red flag when recorded vitals breach a structured rule', () => {
    // VIC UTI RF-1: temperature > 38 °C → REFER_URGENT
    render(
      <ProtocolPanel
        conditionSlug="uncomplicated-uti"
        state="VIC"
        formData={{ temperature: '38.5' }}
        compact
      />
    );
    const title = screen.getByText(/Management of Urinary Tract Infections/);
    expect(title).toBeTruthy();
    fireEvent.click(title);
    const body = document.body.textContent || '';
    expect(body).toContain('Live trigger');
    expect(body).toMatch(/REFER_URGENT/);
  });

  it('renders nothing when no condition slug is provided', () => {
    const { container } = render(<ProtocolPanel />);
    expect(container.textContent?.trim() || '').toBe('');
  });
});