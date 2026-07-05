import { AnimatePresence } from 'framer-motion';
import { lazy, Suspense, useMemo, useState } from 'react';

import { ControlPanel } from '../components/ControlPanel';
import { SearchBox } from '../features/search/SearchBox';
import { GazetteerMap } from '../features/map/GazetteerMap';
import { useAppStore } from '../store/appStore';
import type { DetailMode } from '../types/app';

const ExplorerPanel = lazy(() =>
  import('../components/ExplorerPanel').then((module) => ({ default: module.ExplorerPanel })),
);
const DetailModal = lazy(() =>
  import('../components/DetailModal').then((module) => ({ default: module.DetailModal })),
);

export function GazetteerPage() {
  const [activeDetail, setActiveDetail] = useState<DetailMode | null>(null);
  const selectedPlace = useAppStore((state) => state.selectedPlace);
  const darkMode = useAppStore((state) => state.darkMode);

  const canShowDetail = useMemo(() => Boolean(selectedPlace && activeDetail), [activeDetail, selectedPlace]);

  return (
    <main className={`relative h-screen w-screen overflow-hidden text-white ${darkMode ? 'app-dark bg-ink' : 'bg-mist'}`}>
      <GazetteerMap />
      <SearchBox />
      <ControlPanel onOpenDetail={setActiveDetail} />
      <Suspense fallback={null}>
        <ExplorerPanel />
      </Suspense>
      <Suspense fallback={null}>
        <AnimatePresence>
          {canShowDetail ? <DetailModal mode={activeDetail!} onClose={() => setActiveDetail(null)} /> : null}
        </AnimatePresence>
      </Suspense>
    </main>
  );
}
