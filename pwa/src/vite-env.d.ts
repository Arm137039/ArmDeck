/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="web-bluetooth" />
/// <reference types="vite-plugin-svgr/client" />

// Définition pour l'importation directe de SVG
declare module '*.svg' {
  import React from 'react';
  const SVG: React.FC<React.SVGProps<SVGSVGElement>>;
  export default SVG;
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
}
