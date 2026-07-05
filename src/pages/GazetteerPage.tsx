import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';

import { ControlPanel } from '../components/ControlPanel';
import { DetailModal } from '../components/DetailModal';
import { ExplorerPanel } from '../components/ExplorerPanel';
import { SearchBox } from '../features/search/SearchBox';
import { GazetteerMap } from '../features/map/GazetteerMap';
import { useAppStore } from '../store/appStore';
import type { DetailMode } from '../types/app';

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
      <ExplorerPanel />
      <AnimatePresence>
        {canShowDetail ? <DetailModal mode={activeDetail!} onClose={() => setActiveDetail(null)} /> : null}
      </AnimatePresence>
    </main>
  );
}
