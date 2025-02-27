import type { DTabsRef } from '@react-devui/ui/components/tabs';

import { isUndefined } from 'lodash';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { BellOutlined, LoadingOutlined } from '@react-devui/icons';
import { DAvatar, DBadge, DButton, DPopover, DSeparator, DTabs } from '@react-devui/ui';
import { WINDOW_SPACE } from '@react-devui/ui/utils';
import { getClassName } from '@react-devui/utils';

import { AppList } from '../../../../components';
import { useNotificationState } from '../../../../core';
import styles from './Notification.module.scss';

export function AppNotification(props: React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element | null {
  const tabsRef = useRef<DTabsRef>(null);

  const [notification] = useNotificationState();
  const { t } = useTranslation();

  const num = (() => {
    let n = 0;
    if (!isUndefined(notification)) {
      notification.forEach((notify) => {
        n += notify.list.filter((item) => !item.read).length;
      });
    }
    return n;
  })();

  return (
    <DPopover
      className={getClassName(styles['app-notification'], {
        [styles['app-notification--spinner']]: isUndefined(notification),
      })}
      dContent={
        isUndefined(notification) ? (
          <LoadingOutlined dTheme="primary" dSize={24} dSpin />
        ) : (
          <>
            <DTabs
              ref={tabsRef}
              dList={notification.map((notify) => ({
                id: notify.id,
                title: notify.title,
                panel: (
                  <AppList
                    aList={notify.list.map((item, index) => ({
                      avatar: <DAvatar dImg={{ src: '/assets/imgs/avatar.png', alt: 'avatar' }}></DAvatar>,
                      title: 'name',
                      subtitle: index === 0 && new Date().toLocaleString(),
                      description: item.message,
                      props: {
                        className: getClassName(styles['app-notification__item'], {
                          [styles['app-notification__item--read']]: item.read,
                        }),
                      },
                    }))}
                  ></AppList>
                ),
              }))}
              dCenter
            />
            <div className={styles['app-notification__actions']}>
              <DButton dType="link">{t('routes.layout.Clear notifications')}</DButton>
              <DSeparator style={{ margin: 0 }} dVertical></DSeparator>
              <DButton dType="link">{t('routes.layout.See more')}</DButton>
            </div>
          </>
        )
      }
      dTrigger="click"
      dPlacement="bottom-right"
      dArrow={false}
      dInWindow={WINDOW_SPACE}
      afterVisibleChange={(visible) => {
        if (visible && tabsRef.current) {
          tabsRef.current.updateIndicator();
        }
      }}
    >
      <button {...props} aria-label={t('routes.layout.Notification')}>
        <div style={{ position: 'relative' }}>
          <DBadge dValue={num} dDot />
          <BellOutlined />
        </div>
      </button>
    </DPopover>
  );
}
