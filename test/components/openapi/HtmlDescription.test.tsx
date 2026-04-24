// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HtmlDescription } from '../../../src/components/openapi/HtmlDescription';

afterEach(cleanup);

describe('HtmlDescription', () => {
  it('renders basic text inside a span', () => {
    render(<HtmlDescription html="Hello World" />);
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('renders allowed HTML tags like <strong> and <em>', () => {
    render(<HtmlDescription html="<strong>Bold</strong> and <em>italic</em>" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('strong')?.textContent).toBe('Bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('strips disallowed tags like <script>', () => {
    render(<HtmlDescription html="<script>alert('xss')</script>Safe text" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('Safe text');
  });

  it('strips <img> tags (disallowed)', () => {
    render(<HtmlDescription html='<img src="x" onerror="alert(1)">Text' />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Text');
  });

  it('allows table elements', () => {
    render(
      <HtmlDescription html="<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>" />
    );
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('th')?.textContent).toBe('Header');
    expect(container.querySelector('td')?.textContent).toBe('Cell');
  });

  it('allows list elements (ul, ol, li)', () => {
    render(<HtmlDescription html="<ul><li>Item 1</li><li>Item 2</li></ul>" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('sanitizes links: allows http/https href and adds target/rel', () => {
    render(<HtmlDescription html='<a href="https://example.com">Link</a>' />);
    const link = document.querySelector('.openapi-description a') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('blocks javascript: protocol in href', () => {
    render(<HtmlDescription html='<a href="javascript:alert(1)">Bad Link</a>' />);
    const link = document.querySelector('.openapi-description a') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBeNull();
  });

  it('allows relative URLs in href', () => {
    render(<HtmlDescription html='<a href="/docs/page">Relative</a>' />);
    const link = document.querySelector('.openapi-description a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/docs/page');
  });

  it('allows hash URLs in href', () => {
    render(<HtmlDescription html='<a href="#section">Hash</a>' />);
    const link = document.querySelector('.openapi-description a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#section');
  });

  it('strips disallowed attributes', () => {
    render(<HtmlDescription html='<div onclick="alert(1)" style="color:red">Content</div>' />);
    const div = document.querySelector('.openapi-description div') as HTMLElement;
    expect(div).not.toBeNull();
    expect(div.getAttribute('onclick')).toBeNull();
    expect(div.getAttribute('style')).toBeNull();
  });

  it('preserves allowed attributes like class, colspan, rowspan', () => {
    render(
      <HtmlDescription html='<table><tr><td colspan="2" class="wide">Cell</td></tr></table>' />
    );
    const td = document.querySelector('.openapi-description td') as HTMLElement;
    expect(td.getAttribute('colspan')).toBe('2');
    expect(td.getAttribute('class')).toBe('wide');
  });

  it('applies custom className', () => {
    render(<HtmlDescription html="<p>Test</p>" className="my-custom-class" />);
    const container = document.querySelector('.openapi-description.my-custom-class');
    expect(container).not.toBeNull();
  });

  it('renders empty HTML without crashing', () => {
    render(<HtmlDescription html="" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.innerHTML).toBe('');
  });

  it('handles nested disallowed elements by preserving child text', () => {
    render(<HtmlDescription html="<form><input type='text'><button>Submit</button></form>" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    // Text from disallowed children is preserved
    expect(container.textContent).toContain('Submit');
  });

  it('handles heading tags (h1-h6)', () => {
    render(<HtmlDescription html="<h1>Title</h1><h3>Subtitle</h3>" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('h1')?.textContent).toBe('Title');
    expect(container.querySelector('h3')?.textContent).toBe('Subtitle');
  });

  it('handles blockquote and hr', () => {
    render(<HtmlDescription html="<blockquote>Quote</blockquote><hr>" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('blockquote')?.textContent).toBe('Quote');
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('handles definition lists (dl, dt, dd)', () => {
    render(<HtmlDescription html="<dl><dt>Term</dt><dd>Definition</dd></dl>" />);
    const container = document.querySelector('.openapi-description')!;
    expect(container.querySelector('dt')?.textContent).toBe('Term');
    expect(container.querySelector('dd')?.textContent).toBe('Definition');
  });
});
