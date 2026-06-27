import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { JobsList } from './pages/JobsList';
import { JobDetail } from './pages/JobDetail';
import { NewJob } from './pages/NewJob';
import { AISettings } from './pages/AISettings';
import { NotFound } from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'jobs', Component: JobsList },
      { path: 'jobs/new', Component: NewJob },
      { path: 'jobs/:id', Component: JobDetail },
      { path: 'settings/ai-config', Component: AISettings },
      { path: '*', Component: NotFound },
    ],
  },
]);
