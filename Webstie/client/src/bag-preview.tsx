// Dev-only preview of the 3D bag (not part of the production build): /bag-preview.html?az=0&rotate=0
import ReactDOM from 'react-dom/client';
import { BirkinBag3D } from './components/BirkinBag3D';

const params = new URLSearchParams(window.location.search);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BirkinBag3D autoRotate={params.get('rotate') !== '0'} initialAzimuth={Number(params.get('az') ?? 28)} />,
);
