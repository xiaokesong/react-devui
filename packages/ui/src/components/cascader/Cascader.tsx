import type { DCloneHTMLElement, DId, DSize } from '../../utils/types';
import type { ComboboxKeyDownRef } from '../_keyboard';
import type { DDropdownItem } from '../dropdown';
import type { DFormControl } from '../form';
import type { DSelectItem } from '../select';
import type { AbstractTreeNode, TreeOrigin } from '../tree/abstract-node';

import { isNull, isUndefined } from 'lodash';
import React, { useCallback, useState, useMemo, useRef, useImperativeHandle } from 'react';

import { useEventCallback, useId } from '@react-devui/hooks';
import { CloseOutlined, LoadingOutlined } from '@react-devui/icons';
import { findNested, getClassName, getVerticalSidePosition } from '@react-devui/utils';

import { useGeneralContext, useDValue } from '../../hooks';
import { cloneHTMLElement, registerComponentMate, TTANSITION_DURING_POPUP, WINDOW_SPACE } from '../../utils';
import { DComboboxKeyboard } from '../_keyboard';
import { DSelectbox } from '../_selectbox';
import { DTransition } from '../_transition';
import { DDropdown } from '../dropdown';
import { useFormControl } from '../form';
import { useComponentConfig, usePrefixConfig, useTranslation } from '../root';
import { DTag } from '../tag';
import { DSearchPanel as DTreeSearchPanel } from '../tree/SearchPanel';
import { MultipleTreeNode } from '../tree/multiple-node';
import { SingleTreeNode } from '../tree/single-node';
import { getText, TREE_NODE_KEY } from '../tree/utils';
import { DList } from './List';

export interface DCascaderRef {
  updatePosition: () => void;
}

export type DSearchItem<V extends DId, T extends TreeOrigin> = DSelectItem<V> & { [TREE_NODE_KEY]: AbstractTreeNode<V, T> };

export interface DCascaderItem<V extends DId> {
  label: string;
  value: V;
  loading?: boolean;
  disabled?: boolean;
  children?: DCascaderItem<V>[];
}

export interface DCascaderProps<V extends DId, T extends DCascaderItem<V>> extends React.HTMLAttributes<HTMLDivElement> {
  dRef?: {
    input?: React.ForwardedRef<HTMLInputElement>;
  };
  dFormControl?: DFormControl;
  dList: T[];
  dModel?: V | null | V[];
  dVisible?: boolean;
  dPlaceholder?: string;
  dSize?: DSize;
  dLoading?: boolean;
  dSearchable?: boolean;
  dSearchValue?: string;
  dClearable?: boolean;
  dDisabled?: boolean;
  dMultiple?: boolean;
  dOnlyLeafSelectable?: boolean;
  dVirtual?: boolean;
  dCustomItem?: (item: T) => React.ReactNode;
  dCustomSelected?: (select: T) => string;
  dCustomSearch?: {
    filter?: (value: string, item: T) => boolean;
    sort?: (a: T, b: T) => number;
  };
  dPopupClassName?: string;
  dInputRender?: DCloneHTMLElement<React.InputHTMLAttributes<HTMLInputElement>>;
  onModelChange?: (value: any, item: any) => void;
  onVisibleChange?: (visible: boolean) => void;
  onSearchValueChange?: (value: string) => void;
  onClear?: () => void;
  onFirstFocus?: (value: T['value'], item: T) => void;
  afterVisibleChange?: (visible: boolean) => void;
}

const { COMPONENT_NAME } = registerComponentMate({ COMPONENT_NAME: 'DCascader' as const });
function Cascader<V extends DId, T extends DCascaderItem<V>>(
  props: DCascaderProps<V, T>,
  ref: React.ForwardedRef<DCascaderRef>
): JSX.Element | null {
  const {
    dRef,
    dFormControl,
    dList,
    dModel,
    dVisible,
    dPlaceholder,
    dSize,
    dLoading = false,
    dSearchable = false,
    dSearchValue,
    dClearable = false,
    dDisabled = false,
    dMultiple = false,
    dOnlyLeafSelectable = true,
    dVirtual = false,
    dCustomItem,
    dCustomSelected,
    dCustomSearch,
    dPopupClassName,
    dInputRender,
    onModelChange,
    onVisibleChange,
    onSearchValueChange,
    onClear,
    onFirstFocus,
    afterVisibleChange,

    ...restProps
  } = useComponentConfig(COMPONENT_NAME, props);

  //#region Context
  const dPrefix = usePrefixConfig();
  const { gSize, gDisabled } = useGeneralContext();
  //#endregion

  //#region Ref
  const boxRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const comboboxKeyDownRef = useRef<ComboboxKeyDownRef>(null);
  //#endregion

  const dataRef = useRef<{
    focusList: Set<V>;
  }>({
    focusList: new Set(),
  });

  const [t] = useTranslation();

  const uniqueId = useId();
  const listId = `${dPrefix}cascader-list-${uniqueId}`;
  const getItemId = (val: V) => `${dPrefix}cascader-item-${val}-${uniqueId}`;

  const renderNodes = useMemo(
    () =>
      dList.map((item) =>
        dMultiple
          ? new MultipleTreeNode(item, (origin) => origin.value, {
              disabled: item.disabled,
            })
          : new SingleTreeNode(item, (origin) => origin.value, {
              disabled: item.disabled,
            })
      ),
    [dMultiple, dList]
  );
  const nodesMap = useMemo(() => {
    const nodes = new Map<V, AbstractTreeNode<V, T>>();
    const reduceArr = (arr: AbstractTreeNode<V, T>[]) => {
      for (const item of arr) {
        nodes.set(item.id, item);
        if (item.children) {
          reduceArr(item.children);
        }
      }
    };
    reduceArr(renderNodes);
    return nodes;
  }, [renderNodes]);

  const [searchValue, changeSearchValue] = useDValue<string>('', dSearchValue, onSearchValueChange);

  const [visible, changeVisible] = useDValue<boolean>(false, dVisible, onVisibleChange);
  const formControlInject = useFormControl(dFormControl);
  const [_select, changeSelect] = useDValue<V | null | V[]>(
    dMultiple ? [] : null,
    dModel,
    (value) => {
      if (onModelChange) {
        if (dMultiple) {
          onModelChange(
            value,
            (value as V[]).map((v) => nodesMap.get(v)?.origin)
          );
        } else {
          onModelChange(value, isNull(value) ? null : nodesMap.get(value as V)?.origin);
        }
      }
    },
    undefined,
    formControlInject
  );
  const select = useMemo(() => (dMultiple ? new Set(_select as V[]) : (_select as V | null)), [_select, dMultiple]);
  renderNodes.forEach((node) => {
    node.updateStatus(select);
  });

  const size = dSize ?? gSize;
  const disabled = (dDisabled || gDisabled || dFormControl?.control.disabled) ?? false;

  const hasSearch = searchValue.length > 0;
  const hasSelected = dMultiple ? (select as Set<V>).size > 0 : !isNull(select);

  const [focusVisible, setFocusVisible] = useState(false);

  const filterFn = useCallback(
    (item: T, searchStr = searchValue) => {
      const defaultFilterFn = (item: T) => {
        return item.label.includes(searchStr);
      };
      return dCustomSearch && dCustomSearch.filter ? dCustomSearch.filter(searchStr, item) : defaultFilterFn(item);
    },
    [dCustomSearch, searchValue]
  );
  const sortFn = dCustomSearch?.sort;
  const searchList = useMemo(() => {
    if (!hasSearch) {
      return [];
    }

    const searchList: DSearchItem<V, T>[] = [];
    const reduceNodes = (nodes: AbstractTreeNode<V, T>[]) => {
      nodes.forEach((node) => {
        if ((!dMultiple && !dOnlyLeafSelectable) || node.isLeaf) {
          if (filterFn(node.origin)) {
            searchList.push({
              label: getText(node),
              value: node.id,
              disabled: node.disabled,
              [TREE_NODE_KEY]: node,
            });
          }
        }
        if (node.children) {
          reduceNodes(node.children);
        }
      });
    };
    reduceNodes(renderNodes);

    if (sortFn) {
      searchList.sort((a, b) => sortFn(a[TREE_NODE_KEY].origin, b[TREE_NODE_KEY].origin));
    }
    return searchList;
  }, [dMultiple, dOnlyLeafSelectable, filterFn, hasSearch, renderNodes, sortFn]);

  const [_noSearchFocusItem, setNoSearchFocusItem] = useState<AbstractTreeNode<V, T> | undefined>();
  const noSearchFocusItem = (() => {
    if (_noSearchFocusItem) {
      const node = nodesMap.get(_noSearchFocusItem.id);
      if (node && node.enabled) {
        return node;
      }
    }

    if (hasSelected) {
      return findNested(renderNodes, (node) => node.enabled && node.checked);
    }
  })();

  const [_searchFocusItem, setSearchFocusItem] = useState<DSearchItem<V, T> | undefined>();
  const searchFocusItem = (() => {
    if (_searchFocusItem && findNested(searchList, (item) => item[TREE_NODE_KEY].enabled && item.value === _searchFocusItem.value)) {
      return _searchFocusItem;
    }

    if (hasSearch) {
      return findNested(searchList, (item) => item[TREE_NODE_KEY].enabled);
    }
  })();

  const handleClear = () => {
    onClear?.();

    if (dMultiple) {
      changeSelect([]);
    } else {
      changeSelect(null);
    }
  };

  const [popupPositionStyle, setPopupPositionStyle] = useState<React.CSSProperties>({
    top: '-200vh',
    left: '-200vw',
  });
  const [transformOrigin, setTransformOrigin] = useState<string>();
  const updatePosition = useEventCallback(() => {
    if (visible && boxRef.current && popupRef.current) {
      const height = popupRef.current.offsetHeight;
      const maxWidth = window.innerWidth - WINDOW_SPACE * 2;
      const width = Math.min(popupRef.current.scrollWidth, maxWidth);
      const { top, left, transformOrigin } = getVerticalSidePosition(
        boxRef.current,
        { width, height },
        {
          placement: 'bottom-left',
          inWindow: WINDOW_SPACE,
        }
      );
      setPopupPositionStyle({
        top,
        left,
        maxWidth,
      });
      setTransformOrigin(transformOrigin);
    }
  });

  useImperativeHandle(
    ref,
    () => ({
      updatePosition,
    }),
    [updatePosition]
  );

  const [selectedNode, suffixNode, selectedLabel] = (() => {
    let selectedNode: React.ReactNode = null;
    let suffixNode: React.ReactNode = null;
    let selectedLabel: string | undefined;
    if (dMultiple) {
      const selectedNodes = (_select as V[]).map((v) => nodesMap.get(v) as MultipleTreeNode<V, T>);

      suffixNode = (
        <DDropdown
          dList={selectedNodes.map<DDropdownItem<V> & { node: MultipleTreeNode<V, T> }>((node) => {
            const { value: itemValue, disabled: itemDisabled } = node.origin;
            const text = dCustomSelected ? dCustomSelected(node.origin) : getText(node);

            return {
              id: itemValue,
              label: text,
              type: 'item',
              disabled: itemDisabled,
              node,
            };
          })}
          dCloseOnClick={false}
          onItemClick={(id, item) => {
            const checkeds = (item.node as MultipleTreeNode<V, T>).changeStatus('UNCHECKED', select as Set<V>);
            changeSelect(Array.from(checkeds.keys()));
          }}
        >
          <DTag className={`${dPrefix}cascader__multiple-count`} tabIndex={-1} dSize={size}>
            {(select as Set<V>).size}
          </DTag>
        </DDropdown>
      );
      selectedNode = selectedNodes.map((node) => (
        <DTag key={node.id} className={`${dPrefix}cascader__multiple-tag`} dSize={size}>
          {dCustomSelected ? dCustomSelected(node.origin) : node.origin.label}
          {!(node.disabled || disabled) && (
            <div
              className={`${dPrefix}cascader__close`}
              role="button"
              aria-label={t('Close')}
              onClick={(e) => {
                e.stopPropagation();

                const checkeds = (node as MultipleTreeNode<V, T>).changeStatus('UNCHECKED', select as Set<V>);
                changeSelect(Array.from(checkeds.keys()));
              }}
            >
              <CloseOutlined />
            </div>
          )}
        </DTag>
      ));
    } else {
      if (!isNull(select)) {
        const node = nodesMap.get(select as V)!;
        selectedLabel = getText(node);
        selectedNode = dCustomSelected ? dCustomSelected(node.origin) : selectedLabel;
      }
    }
    return [selectedNode, suffixNode, selectedLabel];
  })();

  return (
    <DSelectbox
      {...restProps}
      onClick={(e) => {
        restProps.onClick?.(e);

        changeVisible((draft) => (dSearchable ? true : !draft));
      }}
      dRef={{
        box: boxRef,
        input: dRef?.input,
      }}
      dClassNamePrefix="cascader"
      dFormControl={dFormControl}
      dVisible={visible}
      dContent={hasSelected && selectedNode}
      dContentTitle={selectedLabel}
      dPlaceholder={dPlaceholder}
      dSuffix={suffixNode}
      dSize={size}
      dLoading={dLoading}
      dSearchable={dSearchable}
      dClearable={dClearable}
      dDisabled={disabled}
      dUpdatePosition={{
        fn: updatePosition,
        popupRef,
        extraScrollRefs: [],
      }}
      dInputRender={(el) => (
        <DComboboxKeyboard
          dVisible={visible}
          dEditable={dSearchable}
          dHasSub={!hasSearch}
          onVisibleChange={changeVisible}
          onFocusChange={(key) => {
            comboboxKeyDownRef.current?.(key);
          }}
        >
          {({ render: renderComboboxKeyboard }) => {
            const input = renderComboboxKeyboard(
              cloneHTMLElement(el, {
                value: searchValue,
                'aria-controls': listId,
                onBlur: (e) => {
                  el.props.onBlur?.(e);

                  changeVisible(false);
                },
                onKeyDown: (e) => {
                  el.props.onKeyDown?.(e);

                  if ((e.code === 'Enter' || (!dSearchable && e.code === 'Space')) && visible) {
                    comboboxKeyDownRef.current?.('click');
                  }
                },
                onChange: (e) => {
                  el.props.onChange?.(e);

                  const val = e.currentTarget.value;
                  if (dSearchable) {
                    changeSearchValue(val);
                  }
                },
              })
            );

            return isUndefined(dInputRender) ? input : dInputRender(input);
          }}
        </DComboboxKeyboard>
      )}
      onFocusVisibleChange={setFocusVisible}
      onClear={handleClear}
    >
      {({ renderPopup }) => (
        <DTransition
          dIn={visible}
          dDuring={TTANSITION_DURING_POPUP}
          onEnter={updatePosition}
          afterEnter={() => {
            afterVisibleChange?.(true);
          }}
          afterLeave={() => {
            afterVisibleChange?.(false);
          }}
        >
          {(state) => {
            let transitionStyle: React.CSSProperties = {};
            switch (state) {
              case 'enter':
                transitionStyle = { transform: 'scaleY(0.7)', opacity: 0 };
                break;

              case 'entering':
                transitionStyle = {
                  transition: ['transform', 'opacity'].map((attr) => `${attr} ${TTANSITION_DURING_POPUP}ms ease-out`).join(', '),
                  transformOrigin,
                };
                break;

              case 'leaving':
                transitionStyle = {
                  transform: 'scaleY(0.7)',
                  opacity: 0,
                  transition: ['transform', 'opacity'].map((attr) => `${attr} ${TTANSITION_DURING_POPUP}ms ease-in`).join(', '),
                  transformOrigin,
                };
                break;

              case 'leaved':
                transitionStyle = { display: 'none' };
                break;

              default:
                break;
            }

            return renderPopup(
              <div
                ref={popupRef}
                className={getClassName(dPopupClassName, `${dPrefix}cascader__popup`)}
                style={{
                  ...popupPositionStyle,
                  ...transitionStyle,
                }}
              >
                {dLoading && (
                  <div
                    className={getClassName(`${dPrefix}cascader__loading`, {
                      [`${dPrefix}cascader__loading--empty`]: (hasSearch ? searchList : renderNodes).length === 0,
                    })}
                  >
                    <LoadingOutlined dSize={(hasSearch ? searchList : renderNodes).length === 0 ? 18 : 24} dSpin />
                  </div>
                )}
                {hasSearch ? (
                  <DTreeSearchPanel
                    ref={comboboxKeyDownRef}
                    id={listId}
                    style={{ pointerEvents: dLoading ? 'none' : undefined }}
                    dGetItemId={getItemId}
                    dList={searchList}
                    dFocusItem={searchFocusItem}
                    dCustomItem={dCustomItem}
                    dMultiple={dMultiple}
                    dOnlyLeafSelectable={dOnlyLeafSelectable}
                    dFocusVisible={focusVisible}
                    dVirtual={dVirtual}
                    onFocusChange={(item) => {
                      if (!dataRef.current.focusList.has(item.value)) {
                        dataRef.current.focusList.add(item.value);
                        onFirstFocus?.(item.value, item[TREE_NODE_KEY].origin);
                      }

                      setSearchFocusItem(item);
                    }}
                    onClickItem={(item) => {
                      if (dMultiple) {
                        const checkeds = (item[TREE_NODE_KEY] as MultipleTreeNode<V, T>).changeStatus(
                          item[TREE_NODE_KEY].checked ? 'UNCHECKED' : 'CHECKED',
                          select as Set<V>
                        );
                        changeSelect(Array.from(checkeds.keys()));
                      } else {
                        changeSelect(item[TREE_NODE_KEY].id);
                        changeVisible(false);
                      }
                    }}
                  ></DTreeSearchPanel>
                ) : (
                  <DList
                    ref={comboboxKeyDownRef}
                    id={listId}
                    style={{ pointerEvents: dLoading ? 'none' : undefined }}
                    dGetItemId={getItemId}
                    dList={renderNodes}
                    dFocusItem={noSearchFocusItem}
                    dCustomItem={dCustomItem}
                    dMultiple={dMultiple}
                    dVirtual={dVirtual}
                    dFocusVisible={focusVisible}
                    dRoot
                    onFocusChange={(node) => {
                      if (!dataRef.current.focusList.has(node.id)) {
                        dataRef.current.focusList.add(node.id);
                        onFirstFocus?.(node.id, node.origin);
                      }

                      setNoSearchFocusItem(node);
                    }}
                    onClickItem={(node) => {
                      if (dMultiple) {
                        const checkeds = (node as MultipleTreeNode<V, T>).changeStatus(
                          node.checked ? 'UNCHECKED' : 'CHECKED',
                          select as Set<V>
                        );
                        changeSelect(Array.from(checkeds.keys()));
                      } else {
                        if (!dOnlyLeafSelectable || node.isLeaf) {
                          changeSelect(node.id);
                        }
                        if (node.isLeaf) {
                          changeVisible(false);
                        }
                      }
                    }}
                  ></DList>
                )}
              </div>
            );
          }}
        </DTransition>
      )}
    </DSelectbox>
  );
}

export const DCascader: <V extends DId, T extends DCascaderItem<V>>(
  props: DCascaderProps<V, T> & React.RefAttributes<DCascaderRef>
) => ReturnType<typeof Cascader> = React.forwardRef(Cascader) as any;
