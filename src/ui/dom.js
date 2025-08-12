export const id = (x)=> document.getElementById(x);
export const qs = (sel,root=document)=> root.querySelector(sel);
export const qsa = (sel,root=document)=> [...root.querySelectorAll(sel)];
