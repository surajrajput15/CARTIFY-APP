import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AboutPage from './AboutPage';

describe('AboutPage', () => {
  it('renders author identity, job title, and E-E-A-T credentials', () => {
    render(
      <BrowserRouter>
        <AboutPage />
      </BrowserRouter>
    );

    // Name and job title presence
    expect(screen.getAllByText('Suraj Bhan Pratap Singh').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Full Stack Software Engineer & MERN Specialist').length).toBeGreaterThan(0);

    // E-E-A-T section
    expect(screen.getByText('Engineered for Google E-E-A-T')).toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Expertise')).toBeInTheDocument();
    expect(screen.getByText('Authoritativeness')).toBeInTheDocument();
    expect(screen.getByText('Trustworthiness')).toBeInTheDocument();

    // Verifiable profile links
    const ghLink = screen.getByRole('link', { name: /github profile/i });
    expect(ghLink).toHaveAttribute('href', 'https://github.com/surajrajput15');

    const liLink = screen.getByRole('link', { name: /linkedin network/i });
    expect(liLink).toHaveAttribute('href', 'https://www.linkedin.com/in/suraj-bhan-pratap-singh-891727293/');
  });
});
