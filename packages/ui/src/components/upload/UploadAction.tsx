import type { DUploadFile } from './Upload';

import { isUndefined } from 'lodash';
import React from 'react';

import { DeleteOutlined, DownloadOutlined, EyeOutlined } from '@react-devui/icons';
import { getClassName, saveFile } from '@react-devui/utils';

import { registerComponentMate } from '../../utils';
import { useComponentConfig, usePrefixConfig, useTranslation } from '../root';

export interface DUploadActionProps extends React.HTMLAttributes<HTMLElement> {
  dPreset?: 'preview' | 'download' | 'remove';
}

export interface DUploadActionPrivateProps {
  __file: DUploadFile;
  __defaultActions?: {
    preview?: (file: DUploadFile) => void;
    download?: (file: DUploadFile) => void;
  };
  __onRemove?: () => void;
}

const { COMPONENT_NAME } = registerComponentMate({ COMPONENT_NAME: 'DUpload.Action' as const });
function UploadAction(props: DUploadActionProps, ref: React.ForwardedRef<any>): JSX.Element | null {
  const {
    children,
    dPreset,
    __file,
    __defaultActions,
    __onRemove,

    ...restProps
  } = useComponentConfig(COMPONENT_NAME, props as DUploadActionProps & DUploadActionPrivateProps);

  //#region Context
  const dPrefix = usePrefixConfig();
  //#endregion

  const [t] = useTranslation();

  const defaultAction = dPreset === 'preview' ? __defaultActions?.preview : dPreset === 'download' ? __defaultActions?.download : undefined;

  return dPreset === 'preview' ? (
    <a
      className={getClassName(restProps.className, `${dPrefix}upload__action`, `${dPrefix}upload__action--preview`, {
        'is-disabled': isUndefined(__file.url),
      })}
      target={restProps['target'] ?? '_blank'}
      href={__file.url}
      title={restProps.title ?? t('Upload', 'Preview file')}
      onClick={(e) => {
        restProps.onClick?.(e);

        e.stopPropagation();
        if (!isUndefined(defaultAction)) {
          e.preventDefault();

          defaultAction(__file);
        }
      }}
    >
      {children ?? <EyeOutlined />}
    </a>
  ) : dPreset === 'download' ? (
    <button
      {...restProps}
      ref={ref}
      className={getClassName(restProps.className, `${dPrefix}upload__action`)}
      type={restProps['type'] ?? 'button'}
      disabled={isUndefined(__file.url)}
      onClick={(e) => {
        restProps.onClick?.(e);

        e.stopPropagation();
        if (!isUndefined(defaultAction)) {
          defaultAction(__file);
        } else {
          saveFile(__file.url!, __file.name);
        }
      }}
      title={restProps.title ?? t('Upload', 'Download file')}
    >
      {children ?? <DownloadOutlined />}
    </button>
  ) : dPreset === 'remove' ? (
    <button
      {...restProps}
      ref={ref}
      className={getClassName(restProps.className, `${dPrefix}upload__action`)}
      type={restProps['type'] ?? 'button'}
      onClick={(e) => {
        restProps.onClick?.(e);

        e.stopPropagation();
        __onRemove?.();
      }}
      title={restProps.title ?? t('Upload', 'Remove file')}
    >
      {children ?? <DeleteOutlined />}
    </button>
  ) : (
    <button
      {...restProps}
      ref={ref}
      className={getClassName(restProps.className, `${dPrefix}upload__action`)}
      type={restProps['type'] ?? 'button'}
      onClick={(e) => {
        restProps.onClick?.(e);

        e.stopPropagation();
      }}
    >
      {children}
    </button>
  );
}

export const DUploadAction = React.forwardRef(UploadAction);
