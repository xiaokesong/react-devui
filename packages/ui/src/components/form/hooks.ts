import type { DFormControl } from './FormItem';
import type { AbstractControl } from './abstract-control';
import type { FormGroup } from './form-group';

import { isUndefined } from 'lodash';
import React, { useContext, useEffect, useState } from 'react';

import { useEventCallback } from '@react-devui/hooks';

export const DFormUpdateContext = React.createContext<(() => void) | null>(null);

export function useForm<T extends { [K in keyof T]: AbstractControl } = any>(cb: () => FormGroup<T>) {
  const [form, setForm] = useState(() => cb());

  const updateForm = useEventCallback((val?: FormGroup) => {
    isUndefined(val) ? setForm((draft) => draft.clone()) : setForm(val);
  });

  return [form, updateForm] as const;
}

export type DFormControlInject = [any, (val: any) => void] | undefined;

export function useFormControl(formControl?: DFormControl): DFormControlInject {
  const updateForm = useContext(DFormUpdateContext);

  const control = formControl?.control;

  useEffect(() => {
    if (control) {
      const ob = control.asyncVerifyComplete$.subscribe({
        next: (val) => {
          if (val.dirty) {
            updateForm?.();
          }
        },
      });

      return () => {
        ob.unsubscribe();
      };
    }
  }, [control, updateForm]);

  return control
    ? [
        control.value,
        (val: any) => {
          if (control) {
            control.markAsDirty(true);
            control.setValue(val);
            updateForm?.();
          }
        },
      ]
    : undefined;
}
