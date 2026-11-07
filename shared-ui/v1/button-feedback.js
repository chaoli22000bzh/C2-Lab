/* C2 Shared UI v1 - feedback tactile/clavier court après le relâchement.
   La couche n'intercepte pas les événements ni les actions des boutons. */
const pressed=new WeakMap();
const activePointers=new Map();
function getButton(target) {
  return target instanceof Element ? target.closest('body.c2-buttons button:not(:disabled), body.c2-buttons [role="button"]:not([aria-disabled="true"])') : null;
}
function down(button) {
  if(!button)return;
  const previous=pressed.get(button);
  if(previous)clearTimeout(previous);
  pressed.delete(button);
  button.classList.add("c2-pressed");
}
function up(button) {
  if(!button)return;
  const previous=pressed.get(button);
  if(previous)clearTimeout(previous);
  const timeout=setTimeout(()=>{
    button.classList.remove("c2-pressed");
    pressed.delete(button);
  },145);
  pressed.set(button,timeout);
}
document.addEventListener("pointerdown",e=>{
 if(e.button!==0)return;
 const button=getButton(e.target);
 if(button){activePointers.set(e.pointerId,button);down(button);}
});
for(const name of ["pointerup","pointercancel"])document.addEventListener(name,e=>{
 const button=activePointers.get(e.pointerId);
 activePointers.delete(e.pointerId);
 up(button);
});
document.addEventListener("keydown",e=>{
 if(!e.repeat&&(e.key==="Enter"||e.key===" ")&&getButton(e.target))down(getButton(e.target));
});
document.addEventListener("keyup",e=>{
 if(e.key==="Enter"||e.key===" ")up(getButton(e.target));
});
window.addEventListener("blur",()=>{
 activePointers.clear();
 for(const button of document.querySelectorAll("body.c2-buttons .c2-pressed"))button.classList.remove("c2-pressed");
});
