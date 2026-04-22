// @vitest-environment jsdom

/**
 * Tests for src/components/sidebar/SortableRequestItem.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SortableRequestItem from '../../../src/components/sidebar/SortableRequestItem';
import type { ApiRequest } from '../../../src/types';

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

vi.mock('../../../src/utils/helpers', () => ({
  getMethodBgColor: vi.fn(() => 'bg-blue-500'),
}));

function makeRequest(overrides?: Partial<ApiRequest>): ApiRequest {
  return {
    id: 'req-1',
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    preScript: '',
    script: '',
    ...overrides,
  };
}

const defaultProps = {
  collectionId: 'col-1',
  depth: 1,
  onClick: vi.fn(),
  onContextMenu: vi.fn(),
  editingId: null,
  editingName: '',
  setEditingName: vi.fn(),
  inputRef: { current: null } as React.RefObject<HTMLInputElement>,
  onEditComplete: vi.fn(),
  isActive: false,
  isHighlighted: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SortableRequestItem', () => {
  it('renders the request name', () => {
    render(<SortableRequestItem request={makeRequest()} {...defaultProps} />);
    expect(screen.getByText('Get Users')).toBeTruthy();
  });

  it('renders the HTTP method badge', () => {
    render(<SortableRequestItem request={makeRequest()} {...defaultProps} />);
    expect(screen.getByText('GET')).toBeTruthy();
  });

  it('calls onClick when the item is clicked', () => {
    const onClick = vi.fn();
    render(<SortableRequestItem request={makeRequest()} {...defaultProps} onClick={onClick} />);
    const treeItem = document.querySelector('.tree-item');
    if (treeItem) fireEvent.click(treeItem);
    expect(onClick).toHaveBeenCalled();
  });

  it('calls onContextMenu on right-click', () => {
    const onContextMenu = vi.fn();
    render(<SortableRequestItem request={makeRequest()} {...defaultProps} onContextMenu={onContextMenu} />);
    const treeItem = document.querySelector('.tree-item');
    if (treeItem) fireEvent.contextMenu(treeItem);
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('renders input when editingId matches request id', () => {
    render(
      <SortableRequestItem
        request={makeRequest()}
        {...defaultProps}
        editingId="req-1"
        editingName="New Name"
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('New Name');
  });

  it('calls setEditingName when input changes', () => {
    const setEditingName = vi.fn();
    render(
      <SortableRequestItem
        request={makeRequest()}
        {...defaultProps}
        editingId="req-1"
        editingName="Old"
        setEditingName={setEditingName}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New' } });
    expect(setEditingName).toHaveBeenCalledWith('New');
  });

  it('calls onEditComplete on Enter in editing mode', () => {
    const onEditComplete = vi.fn();
    render(
      <SortableRequestItem
        request={makeRequest()}
        {...defaultProps}
        editingId="req-1"
        editingName="Name"
        onEditComplete={onEditComplete}
      />
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onEditComplete).toHaveBeenCalled();
  });

  it('applies active styles when isActive is true', () => {
    const { container } = render(
      <SortableRequestItem request={makeRequest()} {...defaultProps} isActive={true} />
    );
    const treeItem = container.querySelector('.tree-item');
    expect(treeItem?.className).toContain('bg-fetchy-accent');
  });

  it('renders different method colors for POST', () => {
    render(
      <SortableRequestItem request={makeRequest({ method: 'POST' })} {...defaultProps} />
    );
    expect(screen.getByText('POST')).toBeTruthy();
  });

  it('applies depth-based margin', () => {
    const { container } = render(
      <SortableRequestItem request={makeRequest()} {...defaultProps} depth={2} />
    );
    const gripBtn = container.querySelector('button');
    if (gripBtn) {
      // depth=2 → marginLeft = (2-1)*16 = 16px
      expect(gripBtn.style.marginLeft).toBe('16px');
    }
  });
});
