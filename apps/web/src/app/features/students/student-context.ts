import { DestroyRef, effect, inject, type Signal } from '@angular/core';
import { QuickAddService } from '../quick-add/quick-add.service';

/**
 * Поки відкрита сторінка учня, «+» у хедері додає «швидке слово» саме цьому учню.
 * Викликати в конструкторі сторінки.
 */
export function useStudentContext(username: Signal<string>): void {
  const quickAdd = inject(QuickAddService);
  effect(() => quickAdd.studentContext.set(username()));
  inject(DestroyRef).onDestroy(() => quickAdd.studentContext.set(null));
}
