import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { clientRenderPlan } from './lib/clientRouting';

const plan = clientRenderPlan(window.location.pathname, window.__APP__?.path);
const ConsolePage = plan.resolved.page.kind === 'console' ? (await import('./components/SaasConsolePage')).SaasConsolePage : undefined;
const ComparisonPage = plan.resolved.page.kind === 'comparison' ? (await import('./components/PlatformComparisonPage')).PlatformComparisonPage : undefined;
const RealtimeConsole = plan.resolved.page.kind === 'console' && plan.resolved.page.surface === 'realtime'
  ? (await import('./components/ProjectRealtimeConsole')).ProjectRealtimeConsole
  : undefined;
document.documentElement.lang = plan.documentLanguage;
const root = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <App resolved={plan.resolved} consolePage={ConsolePage} comparisonPage={ComparisonPage} realtimeConsole={RealtimeConsole} />
  </StrictMode>
);

// Hydrate only when the prerender explicitly matches the address bar. A static
// fallback can contain a complete but unrelated tree (usually the homepage).
if (root.hasChildNodes() && plan.hydrate) {
  hydrateRoot(root, tree);
} else {
  root.replaceChildren();
  createRoot(root).render(tree);
}
