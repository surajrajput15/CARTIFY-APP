import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  document.body.style.overflow = '';
});

describe('Modal (F-37)', () => {
  it('exposes the dialog to assistive tech (no aria-hidden ancestor)', () => {
    render(
      <Modal title="Test dialog" onClose={vi.fn()}>
        <button type="button">Inside</button>
      </Modal>
    );
    // The P1 bug: aria-hidden="true" on the wrapper removed the dialog from
    // the accessibility tree. getByRole fails if any ancestor hides it.
    const dialog = screen.getByRole('dialog', { name: 'Test dialog' });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const backdrop = dialog.parentElement;
    expect(backdrop.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('moves focus into the dialog on open', () => {
    render(
      <Modal title="Focus trap" onClose={vi.fn()}>
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </Modal>
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First action' }));
  });

  it('keeps Tab cycling inside the dialog', () => {
    render(
      <Modal title="Cycler" onClose={vi.fn()}>
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </Modal>
    );
    const first = screen.getByRole('button', { name: 'First action' });
    const second = screen.getByRole('button', { name: 'Second action' });

    second.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Escapable" onClose={onClose}>
        <button type="button">Action</button>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape while blockClose is set', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Blocked" onClose={onClose} blockClose>
        <button type="button">Action</button>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the trigger after unmount', () => {
    // Trigger button sits outside the modal; mount → focus moves inside,
    // unmount → focus must return to the previously focused element.
    const { rerender } = render(
      <div>
        <button type="button" id="trigger">Open</button>
      </div>
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();

    // Mount modal (focus moves inside), then unmount it (focus returns).
    rerender(
      <div>
        <button type="button" id="trigger">Open</button>
        <Modal title="Temp" onClose={vi.fn()}>
          <button type="button">Action</button>
        </Modal>
      </div>
    );
    expect(document.activeElement).not.toBe(trigger);

    rerender(
      <div>
        <button type="button" id="trigger">Open</button>
      </div>
    );
    expect(document.activeElement).toBe(trigger);
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(
      <Modal title="Locker" onClose={vi.fn()}>
        <button type="button">Action</button>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('ConfirmModal (F-37)', () => {
  it('links the message to the dialog via aria-describedby', () => {
    render(
      <ConfirmModal
        title="Delete product"
        message="This will permanently delete the product."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete product' });
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy);
    expect(message).toBeTruthy();
    expect(message.textContent).toBe('This will permanently delete the product.');
  });
});
