import type { DId } from '../../utils/types';
import type { DUploadFile } from './Upload';
import type { DUploadActionPrivateProps } from './UploadAction';

import { isNumber, isUndefined } from 'lodash';
import React, { useState } from 'react';

import { useImmer, useMount } from '@react-devui/hooks';
import { LoadingOutlined, PaperClipOutlined } from '@react-devui/icons';
import { getClassName } from '@react-devui/utils';

import { TTANSITION_DURING_BASE } from '../../utils';
import { DCollapseTransition } from '../_transition';
import { DProgress } from '../progress';
import { usePrefixConfig } from '../root';

export interface DListProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'children'> {
  dFileList: DUploadFile[];
  dDefaultActions?: {
    preview?: (file: DUploadFile) => void;
    download?: (file: DUploadFile) => void;
  };
  dActions: (file: DUploadFile, index: number) => React.ReactNode[];
  onRemove: (file: DUploadFile) => void;
}

export function DList(props: DListProps): JSX.Element | null {
  const { dFileList, dDefaultActions, dActions, onRemove } = props;

  //#region Context
  const dPrefix = usePrefixConfig();
  //#endregion

  const [removeUIDs, setRemoveUIDs] = useImmer<DId[]>([]);
  const [skipFirstTransition, setSkipFirstTransition] = useState(true);

  useMount(() => {
    setSkipFirstTransition(false);
  });

  return (
    <ul className={`${dPrefix}upload__list`}>
      {dFileList.map((file, index) => {
        const actions = dActions(file, index);

        return (
          <DCollapseTransition
            key={file.uid}
            dOriginalSize={{
              height: 'auto',
            }}
            dCollapsedStyle={{
              height: 0,
            }}
            dIn={!removeUIDs.includes(file.uid)}
            dDuring={TTANSITION_DURING_BASE}
            dStyles={{
              entering: {
                transition: ['height', 'padding', 'margin'].map((attr) => `${attr} ${TTANSITION_DURING_BASE}ms ease-out`).join(', '),
              },
              leaving: {
                transition: ['height', 'padding', 'margin'].map((attr) => `${attr} ${TTANSITION_DURING_BASE}ms ease-in`).join(', '),
              },
              leaved: { display: 'none' },
            }}
            dSkipFirstTransition={skipFirstTransition}
            afterLeave={() => {
              setRemoveUIDs((draft) => {
                draft.splice(
                  draft.findIndex((uid) => uid === file.uid),
                  1
                );
              });
              onRemove(file);
            }}
          >
            {(collapseRef, collapseStyle) => (
              <li
                ref={collapseRef}
                className={getClassName(`${dPrefix}upload__list-item`, `${dPrefix}upload__list-item--${file.status}`)}
                style={collapseStyle}
              >
                <div className={`${dPrefix}upload__list-icon`}>
                  {file.status === 'progress' ? <LoadingOutlined dSpin /> : <PaperClipOutlined />}
                </div>
                <a
                  className={getClassName(`${dPrefix}upload__list-link`, {
                    'is-active': file.status === 'load' && !isUndefined(file.url),
                  })}
                  target="_blank"
                  href={file.url}
                  rel="noreferrer"
                  title={file.name}
                  onClick={(e) => {
                    if (!isUndefined(dDefaultActions?.preview)) {
                      e.preventDefault();

                      dDefaultActions!.preview(file);
                    }
                  }}
                >
                  {file.name}
                </a>
                <div className={`${dPrefix}upload__list-actions`}>
                  {React.Children.map(actions, (action: any) =>
                    React.cloneElement<DUploadActionPrivateProps>(action, {
                      __file: file,
                      __defaultActions: dDefaultActions,
                      __onRemove: () => {
                        setRemoveUIDs((draft) => {
                          draft.push(file.uid);
                        });
                      },
                    })
                  )}
                </div>
                <div className={`${dPrefix}upload__list-progress-wrapper`}>
                  {isNumber(file.percent) && <DProgress dPercent={file.percent} dLineWidth={2} dLabel={false}></DProgress>}
                </div>
              </li>
            )}
          </DCollapseTransition>
        );
      })}
    </ul>
  );
}
