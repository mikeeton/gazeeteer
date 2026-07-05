import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { ErrorPage } from './pages/ErrorPage';
import { GazetteerPage } from './pages/GazetteerPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [{ index: true, element: <GazetteerPage /> }],
  },
]);
