import {createRoot} from 'react-dom/client';
import Workspace from './workspace';
import PixelCursor from './pixel-cursor';
import '@/app/globals.css';
createRoot(document.getElementById('root')!).render(<><Workspace/><PixelCursor/></>);
