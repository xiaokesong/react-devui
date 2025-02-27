import { isUndefined } from 'lodash';
import { Navigate } from 'react-router-dom';

import { useMenu } from '../core';

export default function Home(): JSX.Element | null {
  const [{ firstCanActive }] = useMenu();

  return isUndefined(firstCanActive) ? null : <Navigate to={firstCanActive.path} replace />;
}
