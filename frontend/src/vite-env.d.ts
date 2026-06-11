/// <reference types="vite/client" />

// Declare static image asset imports so TypeScript resolves them correctly.
declare module '*.png' { const src: string; export default src; }
declare module '*.PNG' { const src: string; export default src; }
declare module '*.jpg' { const src: string; export default src; }
declare module '*.jpeg' { const src: string; export default src; }
declare module '*.gif' { const src: string; export default src; }
declare module '*.svg' { const src: string; export default src; }
declare module '*.webp' { const src: string; export default src; }
