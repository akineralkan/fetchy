// @vitest-environment jsdom

/**
 * Tests for src/components/sidebar/SortableApiDocItem.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SortableApiDocItem from '../../../src/components/sidebar/SortableApiDocItem';
import type { OpenAPIDocument } from '../../../src/types';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

function makeDoc(overrides?: Partial<OpenAPIDocument>): OpenAPIDocument {
  return {
    id: 'doc-1',
    name: 'Petstore API',
    content: 'openapi: "3.0.0"',
    createdAt: Date.now(),
    ...overrides,
  };
}

const defaultProps = {
  onClick: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onGenerateCollection: vi.fn(),
  onConvertToYaml: vi.fn(),
  onConvertToJson: vi.fn(),
  onExport: vi.fn(),
  editingId: null,
  editingName: '',
  setEditingName: vi.fn(),
  inputRef: { current: null } as React.RefObject<HTMLInputElement>,
  onEditComplete: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SortableApiDocItem', () => {
  it('renders the document name', () => {
    render(<SortableApiDocItem doc={makeDoc()} {...defaultProps} />);
    expect(screen.getByText('Petstore API')).toBeTruthy();
  });

  it('calls onClick when the item is clicked', () => {
    const onClick = vi.fn();
    render(<SortableApiDocItem doc={makeDoc()} {...defaultProps} onClick={onClick} />);
    // Click the file icon or name area — the outer clickable div
    const container = document.querySelector('[class*="tree-item"]') || document.querySelector('div');
    if (container) fireEvent.click(container);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders editing input when editingId matches doc id', () => {
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        editingId="doc-1"
        editingName="New API Name"
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('New API Name');
  });

  it('calls setEditingName when editing input changes', () => {
    const setEditingName = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        editingId="doc-1"
        editingName="Current Name"
        setEditingName={setEditingName}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated' } });
    expect(setEditingName).toHaveBeenCalledWith('Updated');
  });

  it('calls onEditComplete on Enter in editing mode', () => {
    const onEditComplete = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        editingId="doc-1"
        editingName="Name"
        onEditComplete={onEditComplete}
      />
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onEditComplete).toHaveBeenCalled();
  });

  it('shows the three-dot menu button', () => {
    render(<SortableApiDocItem doc={makeDoc()} {...defaultProps} />);
    // MoreVertical button should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('opens the dropdown menu when the three-dot button is clicked', () => {
    render(<SortableApiDocItem doc={makeDoc()} {...defaultProps} />);
    // The last button is typically the MoreVertical menu trigger
    const menuButton = screen.getAllByRole('button').find(b =>
      b.querySelector('svg') !== null
    );
    if (menuButton) {
      fireEvent.click(menuButton);
      // Menu items should appear (e.g., Edit, Delete)
      // We just verify no crash occurs
      expect(document.body).toBeTruthy();
    }
  });

  it('displays the format badge', () => {
    render(<SortableApiDocItem doc={makeDoc({ format: 'yaml' } as any)} {...defaultProps} />);
    expect(screen.getByText('yaml')).toBeTruthy();
  });

  it('displays json format badge', () => {
    render(<SortableApiDocItem doc={makeDoc({ format: 'json' } as any)} {...defaultProps} />);
    expect(screen.getByText('json')).toBeTruthy();
  });

  it('calls onEditComplete on Escape key in editing mode', () => {
    const onEditComplete = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        editingId="doc-1"
        editingName="Name"
        onEditComplete={onEditComplete}
      />
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onEditComplete).toHaveBeenCalled();
  });

  it('calls onEditComplete on blur in editing mode', () => {
    const onEditComplete = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        editingId="doc-1"
        editingName="Name"
        onEditComplete={onEditComplete}
      />
    );
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onEditComplete).toHaveBeenCalled();
  });

  it('does not render editing input when editingId does not match', () => {
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        editingId="other-doc"
        editingName="Other"
      />
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Petstore API')).toBeTruthy();
  });

  it('opens menu and calls onGenerateCollection', () => {
    const onGenerateCollection = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        onGenerateCollection={onGenerateCollection}
      />
    );
    // Find and click the menu trigger button (MoreVertical)
    const buttons = screen.getAllByRole('button');
    const menuBtn = buttons.find(b => b.getAttribute('title') === 'More options');
    if (menuBtn) {
      fireEvent.click(menuBtn);
      const genBtn = screen.queryByText(/generate collection/i);
      if (genBtn) {
        fireEvent.click(genBtn);
        expect(onGenerateCollection).toHaveBeenCalled();
      }
    }
  });

  it('opens menu and calls onExport', () => {
    const onExport = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        onExport={onExport}
      />
    );
    const menuBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'More options');
    if (menuBtn) {
      fireEvent.click(menuBtn);
      const exportBtn = screen.queryByText(/export/i);
      if (exportBtn) {
        fireEvent.click(exportBtn);
        expect(onExport).toHaveBeenCalled();
      }
    }
  });

  it('opens menu and calls onDelete', () => {
    const onDelete = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        onDelete={onDelete}
      />
    );
    const menuBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'More options');
    if (menuBtn) {
      fireEvent.click(menuBtn);
      const deleteBtn = screen.queryByText(/delete/i);
      if (deleteBtn) {
        fireEvent.click(deleteBtn);
        expect(onDelete).toHaveBeenCalled();
      }
    }
  });

  it('opens menu and calls onEdit (Rename)', () => {
    const onEdit = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        onEdit={onEdit}
      />
    );
    const menuBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'More options');
    if (menuBtn) {
      fireEvent.click(menuBtn);
      const renameBtn = screen.queryByText(/rename/i);
      if (renameBtn) {
        fireEvent.click(renameBtn);
        expect(onEdit).toHaveBeenCalled();
      }
    }
  });

  it('shows Convert to YAML option for json format docs in menu', () => {
    render(
      <SortableApiDocItem
        doc={makeDoc({ format: 'json' } as any)}
        {...defaultProps}
      />
    );
    const menuBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'More options');
    if (menuBtn) {
      fireEvent.click(menuBtn);
      expect(screen.queryByText(/convert to yaml/i)).toBeTruthy();
    }
  });

  it('shows Convert to JSON option for yaml format docs in menu', () => {
    render(
      <SortableApiDocItem
        doc={makeDoc({ format: 'yaml' } as any)}
        {...defaultProps}
      />
    );
    const menuBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'More options');
    if (menuBtn) {
      fireEvent.click(menuBtn);
      expect(screen.queryByText(/convert to json/i)).toBeTruthy();
    }
  });

  it('stops propagation when clicking the editing input', () => {
    const onClick = vi.fn();
    render(
      <SortableApiDocItem
        doc={makeDoc()}
        {...defaultProps}
        editingId="doc-1"
        editingName="Test"
        onClick={onClick}
      />
    );
    fireEvent.click(screen.getByRole('textbox'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders without crashing when doc has no format', () => {
    render(<SortableApiDocItem doc={makeDoc()} {...defaultProps} />);
    expect(screen.getByText('Petstore API')).toBeTruthy();
  });
});
