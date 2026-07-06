import {
  BarChart3,
  FileDown,
  GitCompare,
  Heart,
  MapPin,
  MousePointer2,
  Navigation,
  Route,
} from 'lucide-react';
import { useState } from 'react';

import { useAppStore } from '../store/appStore';
import {
  CompareTab,
  DrawTab,
  EmptyState,
  ExportTab,
  InsightsTab,
  NearbyTab,
  RouteTab,
  SavedTab,
} from './explorer/ExplorerTabs';

type Tab = 'insights' | 'compare' | 'nearby' | 'route' | 'draw' | 'saved' | 'export';

export function ExplorerPanel() {
  const [tab, setTab] = useState<Tab>('insights');
  const selectedPlace = useAppStore((state) => state.selectedPlace);

  return (
    <aside className="explorer-panel glass-panel absolute bottom-4 left-4 z-[1000] w-[min(94vw,28rem)] overflow-hidden text-ink dark-panel">
      <nav
        className="explorer-tabs grid grid-cols-7 border-b border-slate-200/80 bg-slate-50/90 p-1"
        aria-label="Explorer tools"
      >
        <TabButton
          active={tab === 'insights'}
          icon={BarChart3}
          label="Stats"
          onClick={() => setTab('insights')}
        />
        <TabButton
          active={tab === 'compare'}
          icon={GitCompare}
          label="Compare"
          onClick={() => setTab('compare')}
        />
        <TabButton
          active={tab === 'nearby'}
          icon={MapPin}
          label="Nearby"
          onClick={() => setTab('nearby')}
        />
        <TabButton
          active={tab === 'route'}
          icon={Route}
          label="Route"
          onClick={() => setTab('route')}
        />
        <TabButton
          active={tab === 'draw'}
          icon={MousePointer2}
          label="Draw"
          onClick={() => setTab('draw')}
        />
        <TabButton
          active={tab === 'saved'}
          icon={Heart}
          label="Saved"
          onClick={() => setTab('saved')}
        />
        <TabButton
          active={tab === 'export'}
          icon={FileDown}
          label="Export"
          onClick={() => setTab('export')}
        />
      </nav>
      <div className="explorer-panel-body max-h-[42vh] overflow-y-auto p-4 md:max-h-[56vh]">
        {!selectedPlace && tab !== 'saved' ? <EmptyState /> : null}
        {selectedPlace && tab === 'insights' ? <InsightsTab place={selectedPlace} /> : null}
        {selectedPlace && tab === 'compare' ? <CompareTab place={selectedPlace} /> : null}
        {selectedPlace && tab === 'nearby' ? <NearbyTab place={selectedPlace} /> : null}
        {selectedPlace && tab === 'route' ? <RouteTab place={selectedPlace} /> : null}
        {tab === 'draw' ? <DrawTab /> : null}
        {tab === 'saved' ? <SavedTab /> : null}
        {selectedPlace && tab === 'export' ? <ExportTab place={selectedPlace} /> : null}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Navigation;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`grid h-12 min-w-0 place-items-center rounded-md text-xs font-bold transition ${
        active
          ? 'bg-white text-teal shadow-sm ring-1 ring-slate-200/70'
          : 'text-slate-500 hover:bg-white/70 hover:text-ink'
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
