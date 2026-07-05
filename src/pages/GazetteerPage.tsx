import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';

import { ControlPanel } from '../components/ControlPanel';
import { DetailModal } from '../components/DetailModal';
import { SearchBox } from '../features/search/SearchBox';
import { GazetteerMap } from '../features/map/GazetteerMap';
import { useAppStore } from '../store/appStore';
import type { DetailMode } from '../types/app';

export function GazetteerPage() {
  const [activeDetail, setActiveDetail] = useState<DetailMode | null>(null);
  const selectedPlace = useAppStore((state) => state.selectedPlace);

  const canShowDetail = useMemo(() => Boolean(selectedPlace && activeDetail), [activeDetail, selectedPlace]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink text-white">
      <GazetteerMap />
      <SearchBox />
      <ControlPanel onOpenDetail={setActiveDetail} />
      <AnimatePresence>
        {canShowDetail ? <DetailModal mode={activeDetail!} onClose={() => setActiveDetail(null)} /> : null}
      </AnimatePresence>
    </main>
  );
}
