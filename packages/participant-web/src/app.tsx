import { Route, Routes } from 'react-router-dom';
import { Join } from './pages/join';
import { Score } from './pages/score';
import { Reveal } from './pages/reveal';

/**
 * Participant app routing. The join flow handles both a freshly typed code and a
 * deep link (`/j/:code`, how a shared link or QR lands); everything else falls
 * back to the code-entry screen. The score and reveal screens arrive as their
 * own sub-slices.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/j/:code" element={<Join />} />
      <Route path="/score" element={<Score />} />
      <Route path="/reveal" element={<Reveal />} />
      <Route path="*" element={<Join />} />
    </Routes>
  );
}
