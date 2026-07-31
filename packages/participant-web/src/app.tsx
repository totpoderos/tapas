import { Route, Routes } from 'react-router';
import { Join } from './pages/join';
import { Score } from './pages/score';
import { Reveal } from './pages/reveal';

/**
 * Participant app routing. The join flow handles both a freshly typed code and a
 * deep link (`/j/:code`, how a shared link or QR lands); everything else falls
 * back to the code-entry screen.
 *
 * Scoring is paginated, and which dish a participant is on lives in the address
 * rather than in the screen's memory. That is what makes the back control go to
 * the previous dish instead of out of the app, lets the ballot review link
 * straight to the dish it says is missing, and puts a participant back where
 * they were after a reload. `/score` is the ballot itself — where you can see
 * everything and send — and `/score/:dish` is one dish of it.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/j/:code" element={<Join />} />
      <Route path="/score" element={<Score />} />
      <Route path="/score/:dish" element={<Score />} />
      <Route path="/reveal" element={<Reveal />} />
      <Route path="*" element={<Join />} />
    </Routes>
  );
}
