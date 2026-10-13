// Preferências visuais guardadas no navegador: tema (claro/escuro) e barra lateral (aberta/só ícones).
// O script roda antes de a página aparecer, para não piscar o tema errado.
export const THEME_KEY = "dors-theme";
export const SIDE_KEY = "dors-side";

export const PREFS_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;if(localStorage.getItem("${SIDE_KEY}")==="collapsed"){d.dataset.side="collapsed"}}catch(e){}})();`;
