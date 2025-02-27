import type { DId } from '../../utils/types';

import { isNull, isUndefined, nth } from 'lodash';
import React, { useImperativeHandle, useRef, useState } from 'react';

import { useEvent, useId, useRefExtra } from '@react-devui/hooks';
import { findNested, getClassName } from '@react-devui/utils';

import { useDValue } from '../../hooks';
import { registerComponentMate, TTANSITION_DURING_BASE } from '../../utils';
import { ESC_CLOSABLE_DATA } from '../../utils/checkNoExpandedEl';
import { DFocusVisible } from '../_focus-visible';
import { useNestedPopup } from '../_popup';
import { DCollapseTransition } from '../_transition';
import { useComponentConfig, usePrefixConfig } from '../root';
import { DGroup } from './Group';
import { DItem } from './Item';
import { DSub } from './Sub';
import { checkEnableItem, getSameLevelEnableItems } from './utils';

export interface DMenuRef {
  updatePosition: () => void;
}

export type DMenuMode = 'horizontal' | 'vertical' | 'popup' | 'icon';

export interface DMenuItem<ID extends DId> {
  id: ID;
  title: React.ReactNode;
  type: 'item' | 'group' | 'sub';
  icon?: React.ReactNode;
  disabled?: boolean;
  children?: DMenuItem<ID>[];
}

export interface DMenuProps<ID extends DId, T extends DMenuItem<ID>> extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  dList: T[];
  dWidth?: string | number;
  dActive?: ID | null;
  dExpands?: ID[];
  dMode?: DMenuMode;
  dExpandOne?: boolean;
  dExpandTrigger?: 'hover' | 'click';
  onActiveChange?: (id: T['id'], item: T) => void;
  onExpandsChange?: (ids: T['id'][], items: T[]) => void;
}

const { COMPONENT_NAME } = registerComponentMate({ COMPONENT_NAME: 'DMenu' as const });
function Menu<ID extends DId, T extends DMenuItem<ID>>(props: DMenuProps<ID, T>, ref: React.ForwardedRef<DMenuRef>): JSX.Element | null {
  const {
    dList,
    dWidth = 'auto',
    dActive,
    dExpands,
    dMode = 'vertical',
    dExpandOne = false,
    dExpandTrigger,
    onActiveChange,
    onExpandsChange,

    ...restProps
  } = useComponentConfig(COMPONENT_NAME, props);

  //#region Context
  const dPrefix = usePrefixConfig();
  //#endregion

  //#region Ref
  const windowRef = useRefExtra(() => window);
  //#endregion

  const dataRef = useRef<{
    updatePosition: Map<ID, () => void>;
  }>({
    updatePosition: new Map(),
  });

  const uniqueId = useId();
  const getItemId = (id: ID) => `${dPrefix}menu-item-${id}-${uniqueId}`;

  const [activeId, changeActiveId] = useDValue<ID | null, ID>(null, dActive, (id) => {
    if (onActiveChange) {
      onActiveChange(id, findNested(dList, (item) => item.id === id) as T);
    }
  });
  const activeIds = (() => {
    let ids: ID[] | undefined;
    const reduceArr = (arr: T[], subParent: ID[] = []) => {
      for (const item of arr) {
        if (ids) {
          break;
        }
        if (item.children) {
          reduceArr(item.children as T[], item.type === 'sub' ? subParent.concat([item.id]) : subParent);
        } else if (item.id === activeId) {
          ids = subParent.concat([item.id]);
        }
      }
    };
    if (!isNull(activeId)) {
      reduceArr(dList);
    }

    return ids ?? [];
  })();

  const [expandIds, changeExpandIds] = useDValue<ID[]>([], dExpands, (ids) => {
    if (onExpandsChange) {
      let length = ids.length;
      const items: T[] = [];
      const reduceArr = (arr: T[]) => {
        for (const item of arr) {
          if (length === 0) {
            break;
          }

          if (item.children) {
            reduceArr(item.children as T[]);
          } else {
            const index = ids.findIndex((id) => id === item.id);
            if (index !== -1) {
              items[index] = item;
              length -= 1;
            }
          }
        }
      };
      reduceArr(dList);

      onExpandsChange(ids, items);
    }
  });
  const { popupIds, setPopupIds, addPopupId, removePopupId } = useNestedPopup<ID>();
  const [focusIds, setFocusIds] = useState<ID[]>([]);
  const [isFocus, setIsFocus] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const focusId = (() => {
    if (isFocus) {
      if (dMode === 'vertical') {
        return nth(focusIds, -1);
      } else {
        let id: ID | undefined;
        for (const [index, focusId] of focusIds.entries()) {
          id = focusId;
          if (nth(popupIds, index)?.id !== focusId) {
            break;
          }
        }
        return id;
      }
    }
  })();

  const initFocus = () => {
    let firstId: ID | undefined;
    const ids: ID[] = [];
    const reduceArr = (arr: T[]) => {
      for (const item of arr) {
        if (ids.length === 1) {
          break;
        }

        if ((item.type === 'group' || (dMode === 'vertical' && item.type === 'sub' && expandIds.includes(item.id))) && item.children) {
          reduceArr(item.children as T[]);
        } else if (checkEnableItem(item)) {
          if (isUndefined(firstId)) {
            firstId = item.id;
          }
          if (activeIds.includes(item.id)) {
            ids.push(item.id);
          }
        }
      }
    };
    reduceArr(dList);
    setFocusIds(ids.length === 0 ? (isUndefined(firstId) ? [] : [firstId]) : ids);
  };

  useEvent<KeyboardEvent>(
    windowRef,
    'keydown',
    (e) => {
      if (e.code === 'Escape') {
        setPopupIds([]);
      }
    },
    {},
    popupIds.length === 0
  );

  let handleKeyDown: React.KeyboardEventHandler<HTMLElement> | undefined;
  const nodes = (() => {
    const getNodes = (arr: T[], level: number, subParents: T[], inNav = false): JSX.Element[] => {
      const posinset = new Map<ID, [number, number]>();
      let noGroup: T[] = [];
      for (const item of arr) {
        if (item.type === 'group') {
          for (const [i, o] of noGroup.entries()) {
            posinset.set(o.id, [i, noGroup.length]);
          }
          noGroup = [];
        } else {
          noGroup.push(item);
        }
      }
      for (const [i, o] of noGroup.entries()) {
        posinset.set(o.id, [i, noGroup.length]);
      }

      return arr.map((item) => {
        const { id: itemId, title: itemTitle, type: itemType, icon: itemIcon, disabled: itemDisabled = false, children } = item;

        const _subParents = itemType === 'sub' ? subParents.concat([item]) : subParents;
        const id = getItemId(itemId);
        const isExpand = expandIds.includes(itemId);
        const isFocus = itemId === focusId;
        const isEmpty = !(children && children.length > 0);
        const popupState = popupIds.find((v) => v.id === itemId);

        let step = 20;
        let space = 16;
        if (dMode === 'horizontal' && inNav) {
          space = 20;
        }
        if (dMode !== 'vertical' && !inNav) {
          step = 12;
          space = 10;
        }

        const handleItemClick = () => {
          changeActiveId(itemId);
          setFocusIds(subParents.map((parentItem) => parentItem.id).concat([itemId]));
        };

        const handleSubExpand = (sameLevelItems: T[]) => {
          if (isExpand) {
            changeExpandIds((draft) => {
              const index = draft.findIndex((id) => id === itemId);
              draft.splice(index, 1);
            });
          } else {
            if (dExpandOne) {
              const ids = expandIds.filter((id) => sameLevelItems.findIndex((sameLevelItem) => sameLevelItem.id === id) === -1);
              ids.push(itemId);
              changeExpandIds(ids);
            } else {
              changeExpandIds((draft) => {
                draft.push(itemId);
              });
            }
          }
        };

        if (isFocus) {
          handleKeyDown = (e) => {
            const sameLevelItems = getSameLevelEnableItems((nth(subParents, -1)?.children as T[]) ?? dList);
            const focusItem = (val?: T) => {
              if (val) {
                setFocusIds(subParents.map((parentItem) => parentItem.id).concat([val.id]));
              }
            };
            const handleOpenSub = () => {
              if (dMode === 'vertical') {
                if (!isExpand) {
                  handleSubExpand(sameLevelItems);
                }
              } else {
                addPopupId(itemId);
              }
              if (children) {
                const newFocusItem = nth(getSameLevelEnableItems(children), 0);
                if (newFocusItem) {
                  setFocusIds(_subParents.map((parentItem) => parentItem.id).concat([newFocusItem.id]));
                }
              }
            };

            if (dMode === 'horizontal' && inNav) {
              switch (e.code) {
                case 'ArrowUp':
                  e.code = 'ArrowLeft';
                  break;

                case 'ArrowLeft':
                  e.code = 'ArrowUp';
                  break;

                case 'ArrowDown':
                  e.code = 'ArrowRight';
                  break;

                case 'ArrowRight':
                  e.code = 'ArrowDown';
                  break;

                default:
                  break;
              }
            }

            switch (e.code) {
              case 'ArrowUp': {
                e.preventDefault();
                const index = sameLevelItems.findIndex((sameLevelItem) => sameLevelItem.id === itemId);
                const newFocusItem = nth(sameLevelItems, index - 1);
                focusItem(newFocusItem);
                if (dMode !== 'vertical' && newFocusItem && nth(popupIds, -1)?.id === itemId) {
                  setPopupIds(popupIds.slice(0, -1));
                }
                break;
              }

              case 'ArrowDown': {
                e.preventDefault();
                const index = sameLevelItems.findIndex((sameLevelItem) => sameLevelItem.id === itemId);
                const newFocusItem = nth(sameLevelItems, (index + 1) % sameLevelItems.length);
                focusItem(newFocusItem);
                if (dMode !== 'vertical' && newFocusItem && nth(popupIds, -1)?.id === itemId) {
                  setPopupIds(popupIds.slice(0, -1));
                }
                break;
              }

              case 'ArrowLeft': {
                e.preventDefault();
                if (dMode === 'vertical') {
                  changeExpandIds((draft) => {
                    const index = draft.findIndex((id) => id === nth(subParents, -1)?.id);
                    draft.splice(index, 1);
                  });
                } else {
                  setPopupIds(popupIds.slice(0, -1));
                }
                const ids = subParents.map((item) => item.id);
                if (ids.length > 0) {
                  setFocusIds(ids);
                }
                break;
              }

              case 'ArrowRight':
                e.preventDefault();
                if (itemType === 'sub') {
                  handleOpenSub();
                }
                break;

              case 'Home':
                e.preventDefault();
                focusItem(nth(sameLevelItems, 0));
                break;

              case 'End':
                e.preventDefault();
                focusItem(nth(sameLevelItems, -1));
                break;

              case 'Enter':
              case 'Space':
                e.preventDefault();
                if (itemType === 'item') {
                  handleItemClick();
                } else if (itemType === 'sub') {
                  handleOpenSub();
                }
                break;

              default:
                break;
            }
          };
        }

        return (
          <React.Fragment key={itemId}>
            {itemType === 'item' ? (
              <DItem
                dId={id}
                dLevel={level}
                dStep={step}
                dSpace={space}
                dIcon={itemIcon}
                dPosinset={posinset.get(itemId)!}
                dMode={dMode}
                dInNav={inNav}
                dActive={activeId === itemId}
                dFocusVisible={focusVisible && isFocus}
                dDisabled={itemDisabled}
                onItemClick={handleItemClick}
              >
                {itemTitle}
              </DItem>
            ) : itemType === 'group' ? (
              <DGroup
                dId={id}
                dLevel={level}
                dStep={step}
                dSpace={space}
                dList={children && getNodes(children as T[], level + 1, _subParents)}
                dEmpty={isEmpty}
              >
                {itemTitle}
              </DGroup>
            ) : (
              <DSub
                ref={(fn) => {
                  if (isNull(fn)) {
                    dataRef.current.updatePosition.delete(itemId);
                  } else {
                    dataRef.current.updatePosition.set(itemId, fn);
                  }
                }}
                dId={id}
                dLevel={level}
                dStep={step}
                dSpace={space}
                dIcon={itemIcon}
                dList={children && getNodes(children as T[], dMode === 'vertical' ? level + 1 : 0, _subParents)}
                dPopupState={popupState?.visible}
                dTrigger={dExpandTrigger ?? (dMode === 'vertical' ? 'click' : 'hover')}
                dPosinset={posinset.get(itemId)!}
                dMode={dMode}
                dInNav={inNav}
                dActive={(dMode === 'vertical' ? !isExpand : isUndefined(popupState)) && activeIds.includes(itemId)}
                dIncludeActive={activeIds.includes(itemId)}
                dExpand={isExpand}
                dEmpty={isEmpty}
                dFocusVisible={focusVisible && isFocus}
                dDisabled={itemDisabled}
                onVisibleChange={(visible) => {
                  if (visible) {
                    if (subParents.length === 0) {
                      setPopupIds([{ id: itemId, visible: true }]);
                    } else {
                      addPopupId(itemId);
                    }
                  } else {
                    removePopupId(itemId);
                  }
                }}
                onSubClick={() => {
                  if (!itemDisabled) {
                    setFocusIds(subParents.map((parentItem) => parentItem.id).concat([itemId]));

                    if (dMode === 'vertical') {
                      const sameLevelItems = getSameLevelEnableItems((nth(subParents, -1)?.children as T[]) ?? dList);
                      handleSubExpand(sameLevelItems);
                    }
                  }
                }}
              >
                {itemTitle}
              </DSub>
            )}
          </React.Fragment>
        );
      });
    };

    return getNodes(dList, 0, [], true);
  })();

  useImperativeHandle(
    ref,
    () => ({
      updatePosition: () => {
        for (const fn of dataRef.current.updatePosition.values()) {
          fn();
        }
      },
    }),
    []
  );

  return (
    <DCollapseTransition
      dOriginalSize={{
        width: dWidth,
      }}
      dCollapsedStyle={{
        width: 64,
      }}
      dIn={dMode !== 'icon'}
      dDuring={TTANSITION_DURING_BASE}
      dStyles={{
        entering: {
          transition: ['width', 'padding', 'margin'].map((attr) => `${attr} ${TTANSITION_DURING_BASE}ms linear`).join(', '),
        },
        leaving: {
          transition: ['width', 'padding', 'margin'].map((attr) => `${attr} ${TTANSITION_DURING_BASE}ms linear`).join(', '),
        },
      }}
    >
      {(collapseRef, collapseStyle) => {
        const preventBlur: React.MouseEventHandler = (e) => {
          if (e.target !== collapseRef.current && e.button === 0) {
            e.preventDefault();
          }
        };

        return (
          <DFocusVisible onFocusVisibleChange={setFocusVisible}>
            {({ render: renderFocusVisible }) =>
              renderFocusVisible(
                // eslint-disable-next-line jsx-a11y/aria-activedescendant-has-tabindex
                <nav
                  {...restProps}
                  {...{ [ESC_CLOSABLE_DATA]: popupIds.length > 0 }}
                  ref={collapseRef}
                  className={getClassName(restProps.className, `${dPrefix}menu`, {
                    [`${dPrefix}menu--horizontal`]: dMode === 'horizontal',
                  })}
                  style={{
                    ...restProps.style,
                    width: dWidth,
                    ...collapseStyle,
                  }}
                  tabIndex={restProps.tabIndex ?? 0}
                  role="menubar"
                  aria-orientation={dMode === 'horizontal' ? 'horizontal' : 'vertical'}
                  aria-activedescendant={isUndefined(focusId) ? undefined : getItemId(focusId)}
                  onFocus={(e) => {
                    restProps.onFocus?.(e);

                    setIsFocus(true);
                    initFocus();
                  }}
                  onBlur={(e) => {
                    restProps.onBlur?.(e);

                    setIsFocus(false);
                    setPopupIds([]);
                  }}
                  onKeyDown={(e) => {
                    restProps.onKeyDown?.(e);

                    handleKeyDown?.(e);
                  }}
                  onMouseDown={(e) => {
                    restProps.onMouseDown?.(e);

                    preventBlur(e);
                  }}
                  onMouseUp={(e) => {
                    restProps.onMouseUp?.(e);

                    preventBlur(e);
                  }}
                >
                  {nodes}
                </nav>
              )
            }
          </DFocusVisible>
        );
      }}
    </DCollapseTransition>
  );
}

export const DMenu: <ID extends DId, T extends DMenuItem<ID>>(
  props: DMenuProps<ID, T> & React.RefAttributes<DMenuRef>
) => ReturnType<typeof Menu> = React.forwardRef(Menu) as any;
